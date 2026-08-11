const express = require("express");
const rateLimit = require("express-rate-limit");
const db = require("../db/init");
const { requireAuth } = require("../utils/auth-middleware");
const { callAssistant, assistantEnabled } = require("../utils/assistant");
const { getTodayGoalAndStatus } = require("../utils/dailyStatus");

const router = express.Router();
router.use(requireAuth);

const MAX_MESSAGES = 12; // limita el historial que se manda (costo + abuso)
const MAX_MESSAGE_LENGTH = 1000;

// Cada mensaje cuesta contra la cuenta de Groq (dinero o cupo gratis), así
// que un usuario logueado en bucle infinito es un riesgo real de abuso —
// no solo de "molestia", sino de gasto. Dos capas independientes:
// 1) ráfaga: máximo N mensajes en una ventana corta, por USUARIO (no por
//    IP — un usuario real puede estar detrás de la misma IP que otros en
//    una red compartida, y limitar por IP ahí perjudicaría a inocentes).
// 2) tope diario: independiente de qué tan espaciados vengan los mensajes,
//    nadie necesita cientos de mensajes al día para una app de hidratación.
const BURST_WINDOW_MS = 5 * 60 * 1000;
const BURST_MAX_MESSAGES = 10;
const DAILY_MESSAGE_LIMIT = Number(process.env.ASSISTANT_DAILY_LIMIT) || 60;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

const burstLimiter = rateLimit({
  windowMs: BURST_WINDOW_MS,
  max: BURST_MAX_MESSAGES,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.userId),
  message: { error: "Estás mandando mensajes muy rápido. Espera unos minutos e intenta de nuevo." },
});

// Tope diario en memoria (se resetea si el proceso reinicia — aceptable
// para esta escala, mismo patrón que el límite de intentos de login por
// cuenta). Si el backend llegara a correr en varias instancias, convendría
// mover esto a la base de datos.
const dailyUsageByUser = new Map();

function checkAndIncrementDailyUsage(userId) {
  const now = Date.now();
  const entry = dailyUsageByUser.get(userId);
  if (!entry || now - entry.windowStart > DAILY_WINDOW_MS) {
    dailyUsageByUser.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= DAILY_MESSAGE_LIMIT) return false;
  entry.count += 1;
  return true;
}

router.get("/status", (req, res) => {
  res.json({ enabled: assistantEnabled });
});

function buildUserContext(userId) {
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
  if (!profile) return null;

  try {
    const { goal, consumedMl, hydrationStatus } = getTodayGoalAndStatus(userId, profile);
    const parts = [
      `peso ${profile.weight_kg}kg`,
      `${profile.age_years} años`,
      profile.sex === "M" ? "hombre" : "mujer",
      `nivel de actividad ${profile.activity_level}`,
      profile.physio_state !== "normal" ? profile.physio_state : null,
      `meta de hoy ${goal.total_ml}ml`,
      `lleva ${Math.round(consumedMl)}ml`,
      `estado: ${hydrationStatus.status}`,
    ].filter(Boolean);
    return parts.join(", ");
  } catch {
    return null;
  }
}

router.post("/chat", burstLimiter, async (req, res) => {
  try {
    if (!checkAndIncrementDailyUsage(req.userId)) {
      return res.status(429).json({
        error: `Llegaste al límite de ${DAILY_MESSAGE_LIMIT} mensajes del asistente por hoy. Vuelve mañana.`,
      });
    }

    const rawMessages = Array.isArray(req.body.messages) ? req.body.messages : [];

    const messages = rawMessages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return res.status(400).json({ error: "Falta el mensaje del usuario" });
    }

    const userContext = buildUserContext(req.userId);
    const reply = await callAssistant({ messages, userContext });

    res.json({ reply });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
