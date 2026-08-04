const { calculateDailyGoal } = require("./calculator");

// Reconstruye la meta de un día pasado: usa el perfil actual (no
// guardamos snapshots históricos de peso/edad) más el contexto de clima y
// actividad de ESE día específico si existe. Es una aproximación
// razonable, no una máquina del tiempo exacta.
function goalForDate(db, profile, date) {
  const context = db
    .prepare("SELECT * FROM daily_context WHERE user_id = ? AND date = ?")
    .get(profile.user_id, date);

  return calculateDailyGoal({
    weightKg: profile.weight_kg,
    ageYears: profile.age_years,
    sex: profile.sex,
    activityLevel: profile.activity_level,
    physioState: profile.physio_state,
    tempC: context?.temp_override ?? profile.climate_temp,
    humidityPct: context?.humidity_override ?? profile.climate_humidity,
    activityMinutes: context?.activity_minutes ?? profile.default_activity_minutes,
  });
}

module.exports = { goalForDate };
