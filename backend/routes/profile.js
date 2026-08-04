const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../utils/auth-middleware");

const router = express.Router();
router.use(requireAuth);

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isFiniteNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

router.get("/", (req, res) => {
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(req.userId);
  if (!profile) {
    return res.status(404).json({ error: "Perfil no configurado todavía" });
  }
  res.json(profile);
});

router.put("/", (req, res) => {
  const existing = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(req.userId);

  const body = req.body || {};
  // Reemplazo parcial consistente: TODO campo ausente conserva el valor que
  // ya había en la fila (o un default sensato si es una fila nueva) — antes
  // algunos campos se conservaban y otros se pisaban con constantes fijas,
  // lo cual era inconsistente y una trampa para cualquier cliente que no
  // mande el perfil completo (ver hallazgo M5 de la auditoría QA).
  const pick = (key, fallback) => (body[key] !== undefined && body[key] !== null && body[key] !== "" ? body[key] : existing?.[key] ?? fallback);

  const weight_kg = pick("weight_kg", null);
  const age_years = pick("age_years", null);
  const sex = pick("sex", null);
  const tz_offset_minutes = pick("tz_offset_minutes", 0);
  const activity_level = pick("activity_level", "moderado");
  const physio_state = pick("physio_state", "normal");
  const wake_time = pick("wake_time", "07:00");
  const sleep_time = pick("sleep_time", "23:00");
  const default_activity_minutes = pick("default_activity_minutes", 20);
  const climate_temp = pick("climate_temp", 25);
  const climate_humidity = pick("climate_humidity", 60);
  // workout_time es legítimamente opcional (se puede querer borrar), así
  // que solo se toca si vino explícitamente en el body.
  const workout_time = body.workout_time !== undefined ? body.workout_time : existing?.workout_time ?? null;

  if (!isFiniteNumber(weight_kg) || Number(weight_kg) <= 0 || Number(weight_kg) > 400) {
    return res.status(400).json({ error: "weight_kg es requerido y debe estar entre 1 y 400 kg" });
  }
  if (!isFiniteNumber(age_years) || Number(age_years) < 1 || Number(age_years) > 120) {
    return res.status(400).json({ error: "age_years es requerido y debe ser un valor válido" });
  }
  if (!["M", "F"].includes(sex)) {
    return res.status(400).json({ error: "sex debe ser 'M' o 'F'" });
  }
  if (!["sedentario", "moderado", "alto"].includes(activity_level)) {
    return res.status(400).json({ error: "activity_level debe ser sedentario, moderado o alto" });
  }
  if (!["normal", "embarazo", "lactancia"].includes(physio_state)) {
    return res.status(400).json({ error: "physio_state inválido" });
  }
  if (physio_state !== "normal" && sex !== "F") {
    return res.status(400).json({ error: "embarazo/lactancia solo aplica con sex='F'" });
  }
  if (!TIME_RE.test(wake_time)) {
    return res.status(400).json({ error: "wake_time debe tener formato HH:MM" });
  }
  if (!TIME_RE.test(sleep_time)) {
    return res.status(400).json({ error: "sleep_time debe tener formato HH:MM" });
  }
  if (workout_time && !TIME_RE.test(workout_time)) {
    return res.status(400).json({ error: "workout_time debe tener formato HH:MM" });
  }
  if (!isFiniteNumber(default_activity_minutes) || Number(default_activity_minutes) < 0 || Number(default_activity_minutes) > 1440) {
    return res.status(400).json({ error: "default_activity_minutes debe estar entre 0 y 1440" });
  }
  if (!isFiniteNumber(climate_temp) || Number(climate_temp) < -50 || Number(climate_temp) > 60) {
    return res.status(400).json({ error: "climate_temp debe ser un valor realista (-50 a 60°C)" });
  }
  if (!isFiniteNumber(climate_humidity) || Number(climate_humidity) < 0 || Number(climate_humidity) > 100) {
    return res.status(400).json({ error: "climate_humidity debe estar entre 0 y 100" });
  }
  // ±840 min = UTC-14/UTC+14 cubre todas las zonas horarias reales del
  // mundo con margen; cualquier valor fuera de ahí es basura o un error de
  // unidades (ej. mandar horas en vez de minutos).
  if (!isFiniteNumber(tz_offset_minutes) || Math.abs(Number(tz_offset_minutes)) > 840) {
    return res.status(400).json({ error: "tz_offset_minutes fuera de rango válido" });
  }

  const finalWorkoutTime = workout_time || null;

  if (existing) {
    db.prepare(
      `UPDATE profiles SET weight_kg=?, age_years=?, sex=?, tz_offset_minutes=?, activity_level=?, workout_time=?,
       physio_state=?, wake_time=?, sleep_time=?, default_activity_minutes=?, climate_temp=?, climate_humidity=?,
       updated_at=datetime('now')
       WHERE user_id=?`
    ).run(
      Number(weight_kg),
      Number(age_years),
      sex,
      Number(tz_offset_minutes),
      activity_level,
      finalWorkoutTime,
      physio_state,
      wake_time,
      sleep_time,
      Number(default_activity_minutes),
      Number(climate_temp),
      Number(climate_humidity),
      req.userId
    );
  } else {
    db.prepare(
      `INSERT INTO profiles
       (user_id, weight_kg, age_years, sex, tz_offset_minutes, activity_level, workout_time, physio_state, wake_time, sleep_time, default_activity_minutes, climate_temp, climate_humidity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.userId,
      Number(weight_kg),
      Number(age_years),
      sex,
      Number(tz_offset_minutes),
      activity_level,
      finalWorkoutTime,
      physio_state,
      wake_time,
      sleep_time,
      Number(default_activity_minutes),
      Number(climate_temp),
      Number(climate_humidity)
    );
  }

  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(req.userId);
  res.json(profile);
});

module.exports = router;
