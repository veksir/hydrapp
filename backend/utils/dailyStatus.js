const db = require("../db/init");
const { calculateDailyGoal } = require("./calculator");
const { getHydrationStatus } = require("./predictor");
const { localDateStr, localMinuteOfDay, offsetModifier, parseUtcTimestamp } = require("./time");
const { predictThirst } = require("./thirstPredictor");

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
}

function minutesToHHMM(totalMinutes) {
  const m = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// El usuario no siempre se despierta a la hora fija del perfil. Si ya
// pasó bastante tiempo desde esa hora y todavía no hay ningún registro
// hoy, o si el primer trago del día llegó mucho más tarde de lo
// configurado, es más probable que ese día empezó tarde de verdad que
// que llevas horas ignorando la hidratación — así que la "hora de
// despertar" que se usa para los checkpoints se recalibra sola, en vez
// de acumular una deuda irreal que empuja a tomar de golpe para
// "ponerte al día" (justo lo que no queremos).
const LATE_START_GRACE_MINUTES = 90;
const RECALIBRATION_BUFFER_MINUTES = 30;

function effectiveWakeTime({ configuredWakeTime, todayLogs, nowMinute, tz }) {
  const configuredWake = toMinutes(configuredWakeTime);
  const adjNow = nowMinute < configuredWake ? nowMinute + 1440 : nowMinute;

  if (todayLogs.length === 0) {
    if (adjNow - configuredWake > LATE_START_GRACE_MINUTES) {
      return minutesToHHMM(adjNow - RECALIBRATION_BUFFER_MINUTES);
    }
    return configuredWakeTime;
  }

  const firstLogDate = new Date(parseUtcTimestamp(todayLogs[0].logged_at));
  const firstLogMinute = localMinuteOfDay(tz, firstLogDate);
  const adjFirstLog = firstLogMinute < configuredWake ? firstLogMinute + 1440 : firstLogMinute;

  if (adjFirstLog - configuredWake > LATE_START_GRACE_MINUTES) {
    return minutesToHHMM(Math.max(configuredWake, adjFirstLog - RECALIBRATION_BUFFER_MINUTES));
  }
  return configuredWakeTime;
}

/**
 * Calcula meta, logs de hoy, consumo y estado de hidratación para un
 * usuario. Centralizado acá porque tanto /logs/today como /symptoms/check
 * necesitan exactamente lo mismo — antes estaba duplicado en ambos
 * archivos, con el riesgo de corregir un bug en uno y olvidar el otro.
 */
function getTodayGoalAndStatus(userId, profile) {
  const tz = profile.tz_offset_minutes;
  const date = localDateStr(tz);
  const modifier = offsetModifier(tz);

  const context = db
    .prepare("SELECT * FROM daily_context WHERE user_id = ? AND date = ?")
    .get(userId, date);

  const activityMinutes = context?.activity_minutes ?? profile.default_activity_minutes;
  const tempC = context?.temp_override ?? profile.climate_temp;
  const humidityPct = context?.humidity_override ?? profile.climate_humidity;

  const goal = calculateDailyGoal({
    weightKg: profile.weight_kg,
    ageYears: profile.age_years,
    sex: profile.sex,
    activityLevel: profile.activity_level,
    physioState: profile.physio_state,
    tempC,
    humidityPct,
    activityMinutes,
  });

  const todayLogs = db
    .prepare(
      `SELECT * FROM water_logs WHERE user_id = ? AND date(logged_at, ?) = ? ORDER BY logged_at ASC`
    )
    .all(userId, modifier, date);

  const consumedMl = todayLogs.reduce((s, l) => s + l.effective_ml, 0);

  const nowMinute = localMinuteOfDay(tz);
  const wakeTime = effectiveWakeTime({
    configuredWakeTime: profile.wake_time,
    todayLogs,
    nowMinute,
    tz,
  });

  const hydrationStatus = getHydrationStatus({
    wakeTime,
    sleepTime: profile.sleep_time,
    totalMl: goal.total_ml,
    todayLogs,
    nowMinuteOfDay: nowMinute,
    activityMinutes,
    workoutTime: profile.workout_time,
  });

  const thirstPrediction = predictThirst({ todayLogs });
  // La predicción de sed es más elegante y específica que el mensaje
  // genérico de ritmo, así que cuando aplica, reemplaza el mensaje (el
  // estado/color de fondo sigue reflejando el ritmo acumulado real). Pero
  // nunca pisa el aviso de "ya es hora de dormir", y tampoco tiene sentido
  // avisar "vas a tener sed pronto, toma agua" si ya cumpliste o superaste
  // tu meta de hoy — en ese caso el mensaje de ritmo normal (o el aviso de
  // sobrehidratación de logFeedback) es más apropiado.
  const alreadyMetGoal = consumedMl >= goal.total_ml;
  if (thirstPrediction.likely && !hydrationStatus.is_past_bedtime && !alreadyMetGoal) {
    hydrationStatus.message = thirstPrediction.message;
  } else if (thirstPrediction.likely && alreadyMetGoal && !hydrationStatus.is_past_bedtime) {
    hydrationStatus.message = "Ya cumpliste tu meta de hoy. Si sientes sed real, sigue tomando con moderación.";
  }
  hydrationStatus.thirst_prediction = thirstPrediction;

  return { date, context, activityMinutes, tempC, humidityPct, goal, todayLogs, consumedMl, hydrationStatus };
}

module.exports = { getTodayGoalAndStatus, effectiveWakeTime };
