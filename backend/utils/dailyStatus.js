const db = require("../db/init");
const { calculateDailyGoal } = require("./calculator");
const { getHydrationStatus } = require("./predictor");
const { localDateStr, localMinuteOfDay, offsetModifier } = require("./time");
const { predictThirst } = require("./thirstPredictor");

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

  const hydrationStatus = getHydrationStatus({
    wakeTime: profile.wake_time,
    sleepTime: profile.sleep_time,
    totalMl: goal.total_ml,
    todayLogs,
    nowMinuteOfDay: localMinuteOfDay(tz),
    activityMinutes,
    workoutTime: profile.workout_time,
  });

  const thirstPrediction = predictThirst({ todayLogs });
  // La predicción de sed es más elegante y específica que el mensaje
  // genérico de ritmo, así que cuando aplica, reemplaza el mensaje (el
  // estado/color de fondo sigue reflejando el ritmo acumulado real). Pero
  // nunca pisa el aviso de "ya es hora de dormir".
  if (thirstPrediction.likely && !hydrationStatus.is_past_bedtime) {
    hydrationStatus.message = thirstPrediction.message;
  }
  hydrationStatus.thirst_prediction = thirstPrediction;

  return { date, context, activityMinutes, tempC, humidityPct, goal, todayLogs, consumedMl, hydrationStatus };
}

module.exports = { getTodayGoalAndStatus };
