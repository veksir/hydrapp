const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../utils/auth-middleware");
const { callAssistant, assistantEnabled } = require("../utils/assistant");
const { getTodayGoalAndStatus } = require("../utils/dailyStatus");

const router = express.Router();
router.use(requireAuth);

const MAX_MESSAGES = 12; // limita el historial que se manda (costo + abuso)
const MAX_MESSAGE_LENGTH = 1000;

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

router.post("/chat", async (req, res) => {
  try {
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
