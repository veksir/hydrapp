const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../utils/auth-middleware");
const { buildLogFeedback } = require("../utils/logFeedback");
const { getTodayGoalAndStatus } = require("../utils/dailyStatus");
const { localDateStr, offsetModifier } = require("../utils/time");
const { DRINK_TYPES, getDrinkFactor, isValidDrinkType } = require("../utils/drinkTypes");
const { parseUtcTimestamp } = require("../utils/time");
const { goalForDate } = require("../utils/historicalGoal");

const router = express.Router();
router.use(requireAuth);

function getProfileOrThrow(userId) {
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
  if (!profile) {
    const err = new Error("Perfil no configurado");
    err.status = 400;
    throw err;
  }
  return profile;
}

function isFiniteNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

// Catálogo de tipos de bebida (para el bottom sheet de registro) --------
router.get("/drink-types", (req, res) => {
  res.json(DRINK_TYPES);
});

// Contexto del día (actividad de hoy, override de clima) -----------------
router.put("/context/today", (req, res) => {
  try {
    const profile = getProfileOrThrow(req.userId);
    const { activity_minutes, temp_override, humidity_override } = req.body;

    if (activity_minutes !== undefined && (!isFiniteNumber(activity_minutes) || Number(activity_minutes) < 0)) {
      return res.status(400).json({ error: "activity_minutes debe ser un número >= 0" });
    }
    if (temp_override !== undefined && temp_override !== null && !isFiniteNumber(temp_override)) {
      return res.status(400).json({ error: "temp_override debe ser un número" });
    }
    if (
      humidity_override !== undefined &&
      humidity_override !== null &&
      (!isFiniteNumber(humidity_override) || Number(humidity_override) < 0 || Number(humidity_override) > 100)
    ) {
      return res.status(400).json({ error: "humidity_override debe estar entre 0 y 100" });
    }

    const date = localDateStr(profile.tz_offset_minutes);

    const existing = db
      .prepare(`SELECT * FROM daily_context WHERE user_id = ? AND date = ?`)
      .get(req.userId, date);

    // Importante: si todavía no existe una fila de contexto para hoy y solo
    // se está actualizando el clima (ej. botón "usar mi ubicación"), el
    // respaldo de actividad debe ser el default del perfil, NO 0 — si no,
    // actualizar el clima borraba en silencio la actividad típica del día.
    const merged = {
      activity_minutes:
        activity_minutes !== undefined
          ? Number(activity_minutes)
          : existing?.activity_minutes ?? profile.default_activity_minutes,
      activity_is_live: activity_minutes !== undefined ? 1 : existing?.activity_is_live ?? 0,
      temp_override: temp_override !== undefined ? Number(temp_override) : existing?.temp_override ?? null,
      humidity_override:
        humidity_override !== undefined ? Number(humidity_override) : existing?.humidity_override ?? null,
    };

    db.prepare(
      `INSERT INTO daily_context (user_id, date, activity_minutes, activity_is_live, temp_override, humidity_override)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         activity_minutes = excluded.activity_minutes,
         activity_is_live = excluded.activity_is_live,
         temp_override = excluded.temp_override,
         humidity_override = excluded.humidity_override`
    ).run(
      req.userId,
      date,
      merged.activity_minutes,
      merged.activity_is_live,
      merged.temp_override,
      merged.humidity_override
    );

    res.json({ ok: true, context: merged });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Registrar consumo de agua ----------------------------------------------
router.post("/", (req, res) => {
  try {
    const profile = getProfileOrThrow(req.userId);
    const { container_id, amount_ml, drink_type } = req.body;

    const finalDrinkType = drink_type && isValidDrinkType(drink_type) ? drink_type : "agua";

    // Si viene container_id, SIEMPRE se valida que sea del usuario —
    // antes solo se validaba cuando no venía amount_ml, lo que permitía
    // referenciar recipientes de otros usuarios (IDOR) o un id inexistente
    // que terminaba tronando la restricción de llave foránea con un 500.
    let resolvedContainerId = null;
    if (container_id !== undefined && container_id !== null && container_id !== "") {
      const container = db
        .prepare("SELECT * FROM containers WHERE id = ? AND user_id = ?")
        .get(container_id, req.userId);
      if (!container) return res.status(404).json({ error: "Recipiente no encontrado" });
      resolvedContainerId = container.id;
      if (amount_ml === undefined || amount_ml === null || amount_ml === "") {
        req.body.amount_ml = container.volume_ml;
      }
    }

    let finalAmount = req.body.amount_ml;

    if (!isFiniteNumber(finalAmount) || Number(finalAmount) <= 0) {
      return res.status(400).json({ error: "amount_ml o container_id válido son requeridos" });
    }
    finalAmount = Number(finalAmount);

    // Ningún ser humano toma más de esto de una sola vez — si pasa, es casi
    // seguro un error de tipeo (ej. escribir 20000 en vez de 200). Mejor
    // rechazarlo con un mensaje claro que dejarlo pasar en silencio.
    const MAX_SINGLE_LOG_ML = 3000;
    if (finalAmount > MAX_SINGLE_LOG_ML) {
      return res.status(400).json({
        error: `${finalAmount}ml no es realista para un solo registro (máximo ${MAX_SINGLE_LOG_ML}ml). Si tomaste más, regístralo en varias veces.`,
      });
    }
    const effectiveAmount = Math.round(finalAmount * getDrinkFactor(finalDrinkType));

    // Estado ANTES de insertar, para poder decir "acabas de cruzar tu meta"
    const before = getTodayGoalAndStatus(req.userId, profile);

    const result = db
      .prepare(
        "INSERT INTO water_logs (user_id, container_id, amount_ml, drink_type, effective_ml) VALUES (?, ?, ?, ?, ?)"
      )
      .run(req.userId, resolvedContainerId, finalAmount, finalDrinkType, effectiveAmount);

    const log = db.prepare("SELECT * FROM water_logs WHERE id = ?").get(result.lastInsertRowid);

    const after = getTodayGoalAndStatus(req.userId, profile);

    const RECENT_WINDOW_MS = 10 * 60 * 1000;
    const nowMs = Date.now();
    const recentLogs = after.todayLogs.filter((l) => nowMs - parseUtcTimestamp(l.logged_at) <= RECENT_WINDOW_MS);
    const recentBurstMl = recentLogs.reduce((s, l) => s + l.amount_ml, 0);
    const oldestRecentMs = recentLogs.length
      ? Math.min(...recentLogs.map((l) => parseUtcTimestamp(l.logged_at)))
      : nowMs;
    const recentBurstMinutes = Math.round((nowMs - oldestRecentMs) / 60000);

    const feedback = buildLogFeedback({
      amountJustLoggedMl: finalAmount, // el aviso de "de golpe" mira el volumen físico real
      consumedTodayMl: after.consumedMl,
      goalMl: after.goal.total_ml,
      previousConsumedTodayMl: before.consumedMl,
      recentBurstMl,
      recentBurstMinutes,
    });

    res.status(201).json({ log, feedback, consumed_ml: after.consumedMl, goal_ml: after.goal.total_ml });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete("/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM water_logs WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: "Registro no encontrado" });
  res.status(204).send();
});

// Estado de hoy: meta, consumido, predicción -----------------------------
router.get("/today", (req, res) => {
  try {
    const profile = getProfileOrThrow(req.userId);
    const { date, context, activityMinutes, tempC, humidityPct, goal, todayLogs, consumedMl, hydrationStatus } =
      getTodayGoalAndStatus(req.userId, profile);

    res.json({
      date,
      goal,
      logs: todayLogs,
      consumed_ml: consumedMl,
      hydration: hydrationStatus,
      inputs_used: {
        activity_minutes: activityMinutes,
        activity_is_live: Boolean(context?.activity_is_live),
        temp_c: tempC,
        humidity_pct: humidityPct,
        weather_is_live: context?.temp_override != null || context?.humidity_override != null,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Historial de días anteriores --------------------------------------------
// consumed_ml = suma de EFECTIVE_ML (ajustado por tipo de bebida, lo que
//   realmente cuenta para la meta — esto es lo que debe usar el frontend).
// raw_ml = suma de AMOUNT_ML (volumen físico real que se tomó, sin ajustar).
// goal_ml = meta reconstruida de ESE día (perfil actual + contexto de ese
//   día si existe) — así las barras del frontend pueden mostrar % real
//   contra la meta en vez de escalar contra el día de máximo consumo, que
//   distorsiona la lectura. Los días sin ningún registro SÍ aparecen, con
//   consumed_ml=0, para distinguir "bebiste poco" de "no hay dato".
router.get("/history", (req, res) => {
  try {
    const profile = getProfileOrThrow(req.userId);
    const days = Math.min(Math.max(1, Number(req.query.days) || 14), 90);
    const tz = profile.tz_offset_minutes;
    const modifier = offsetModifier(tz);
    const fromDate = localDateStr(tz, new Date(Date.now() - (days - 1) * 86400000));
    const today = localDateStr(tz);

    const rows = db
      .prepare(
        `SELECT date(logged_at, ?) as date, SUM(effective_ml) as consumed_ml, SUM(amount_ml) as raw_ml, COUNT(*) as entries
         FROM water_logs
         WHERE user_id = ? AND date(logged_at, ?) >= ?
         GROUP BY date(logged_at, ?)
         ORDER BY date ASC`
      )
      .all(modifier, req.userId, modifier, fromDate, modifier);

    const byDate = new Map(rows.map((r) => [r.date, r]));

    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(fromDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      if (dateStr > today) break; // no mostrar días futuros

      const existing = byDate.get(dateStr);
      const goal = goalForDate(db, profile, dateStr);
      result.push({
        date: dateStr,
        consumed_ml: Math.round(existing?.consumed_ml ?? 0),
        raw_ml: Math.round(existing?.raw_ml ?? 0),
        entries: existing?.entries ?? 0,
        goal_ml: goal.total_ml,
        pct: Math.round(((existing?.consumed_ml ?? 0) / goal.total_ml) * 100),
      });
    }

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
