const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../utils/auth-middleware");
const { localDateStr, offsetModifier } = require("../utils/time");
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

router.get("/", (req, res) => {
  try {
    const profile = getProfileOrThrow(req.userId);
    const tz = profile.tz_offset_minutes;
    const modifier = offsetModifier(tz);
    const fromDate = localDateStr(tz, new Date(Date.now() - 30 * 86400000));
    const today = localDateStr(tz);

    const rows = db
      .prepare(
        `SELECT date(logged_at, ?) as date, SUM(effective_ml) as consumed_ml
         FROM water_logs
         WHERE user_id = ? AND date(logged_at, ?) >= ?
         GROUP BY date(logged_at, ?)
         ORDER BY date ASC`
      )
      .all(modifier, req.userId, modifier, fromDate, modifier);

    if (rows.length === 0) {
      return res.json({
        has_data: false,
        week_avg_ml: 0,
        month_avg_ml: 0,
        best_day: null,
        current_streak_days: 0,
        heat_effect: null,
      });
    }

    const withGoal = rows.map((r) => {
      const goal = goalForDate(db, profile, r.date);
      return { ...r, goal_ml: goal.total_ml, pct: r.consumed_ml / goal.total_ml, temp_c: goal.breakdown ? null : null };
    });

    const last7 = withGoal.filter((r) => r.date >= localDateStr(tz, new Date(Date.now() - 7 * 86400000)));
    const weekAvg = last7.length ? last7.reduce((s, r) => s + r.consumed_ml, 0) / last7.length : 0;
    const monthAvg = withGoal.reduce((s, r) => s + r.consumed_ml, 0) / withGoal.length;

    const bestDay = withGoal.reduce((best, r) => (r.consumed_ml > (best?.consumed_ml ?? -1) ? r : best), null);

    // Racha: días consecutivos (terminando ayer, para no penalizar el día
    // de hoy que sigue en curso) cumpliendo al menos el 100% de la meta.
    let streak = 0;
    const byDate = new Map(withGoal.map((r) => [r.date, r]));
    let cursor = new Date(Date.now() - 86400000 - tz * 60000);
    for (let i = 0; i < 60; i++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const row = byDate.get(dateStr);
      if (row && row.pct >= 0.8) {
        streak += 1;
        cursor = new Date(cursor.getTime() - 86400000);
      } else {
        break;
      }
    }

    // Efecto del calor: compara el % de meta cumplida en días donde hubo
    // clima registrado >30°C vs. el resto, si hay suficientes datos de cada.
    const hotDays = [];
    const normalDays = [];
    for (const r of withGoal) {
      const context = db
        .prepare("SELECT temp_override FROM daily_context WHERE user_id = ? AND date = ?")
        .get(req.userId, r.date);
      const temp = context?.temp_override ?? profile.climate_temp;
      (temp > 30 ? hotDays : normalDays).push(r.pct);
    }

    let heatEffect = null;
    if (hotDays.length >= 3 && normalDays.length >= 3) {
      const hotAvg = hotDays.reduce((a, b) => a + b, 0) / hotDays.length;
      const normalAvg = normalDays.reduce((a, b) => a + b, 0) / normalDays.length;
      const diffPct = Math.round((1 - hotAvg / normalAvg) * 100);
      if (Math.abs(diffPct) >= 5) {
        heatEffect = {
          diff_pct: diffPct,
          message:
            diffPct > 0
              ? `Cuando hace más de 30°C, sueles tomar ${diffPct}% menos de lo recomendado.`
              : `Cuando hace más de 30°C, en realidad tomas ${Math.abs(diffPct)}% más — buena señal.`,
        };
      }
    }

    res.json({
      has_data: true,
      week_avg_ml: Math.round(weekAvg),
      month_avg_ml: Math.round(monthAvg),
      best_day: bestDay ? { date: bestDay.date, consumed_ml: Math.round(bestDay.consumed_ml) } : null,
      current_streak_days: streak,
      heat_effect: heatEffect,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
