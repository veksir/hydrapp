const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../utils/auth-middleware");
const { createWaterLog } = require("../utils/createWaterLog");
const { getTodayGoalAndStatus } = require("../utils/dailyStatus");
const { localDateStr, offsetModifier } = require("../utils/time");
const { DRINK_TYPES } = require("../utils/drinkTypes");
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
    const { log, feedback, consumedMl, goalMl } = createWaterLog({
      userId: req.userId,
      profile,
      container_id: req.body.container_id,
      amount_ml: req.body.amount_ml,
      drink_type: req.body.drink_type,
    });

    res.status(201).json({ log, feedback, consumed_ml: consumedMl, goal_ml: goalMl });
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
