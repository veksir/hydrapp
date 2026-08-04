/**
 * Motor de cálculo de la meta hídrica diaria.
 *
 * Agua Total (ml) = Base + Estado Fisiológico + Clima + Actividad
 *
 * Base:
 *   - Menores de 19 años: se usa directamente el valor de la tabla IOM
 *     para su edad y sexo (la fórmula ml/kg no aplica bien a esas edades).
 *   - 19+ años: Peso x (30/35/40 ml/kg según nivel de actividad general:
 *     sedentario/moderado/alto), pero nunca por debajo del piso IOM para
 *     su sexo (3000ml hombres / 2200ml mujeres de solo líquidos).
 * - Estado fisiológico: normal +0, embarazo +300, lactancia +700
 * - Clima:
 *     - Por cada grado sobre 30°C -> +100ml
 *     - Si temp > 25°C Y humedad > 70% -> +10% extra sobre el subtotal
 * - Actividad física: minutos de ejercicio x 12ml
 */

const { getIomLiquidsMl, isMinor } = require("./iomTable");

const PHYSIO_BONUS = {
  normal: 0,
  embarazo: 300,
  lactancia: 700,
};

// Método clínico por peso corporal: el factor ml/kg cambia según qué tan
// activa es la persona en general (no confundir con los minutos de
// ejercicio de HOY, que se suman aparte más abajo).
const ACTIVITY_LEVEL_ML_PER_KG = {
  sedentario: 30,
  moderado: 35,
  alto: 40,
};

function calculateDailyGoal({
  weightKg,
  ageYears = null,
  sex = "F",
  activityLevel = "moderado",
  physioState = "normal",
  tempC = 25,
  humidityPct = 60,
  activityMinutes = 0,
}) {
  if (!weightKg || weightKg <= 0) {
    throw new Error("weightKg debe ser un número positivo");
  }

  const iomLiquidsMl = getIomLiquidsMl(ageYears, sex);
  const mlPerKg = ACTIVITY_LEVEL_ML_PER_KG[activityLevel] ?? ACTIVITY_LEVEL_ML_PER_KG.moderado;
  const weightBaseMl = weightKg * mlPerKg;

  let base;
  let baseSource;

  if (isMinor(ageYears) && iomLiquidsMl != null) {
    base = iomLiquidsMl;
    baseSource = "iom_edad";
  } else if (iomLiquidsMl != null && weightBaseMl < iomLiquidsMl) {
    base = iomLiquidsMl;
    baseSource = "iom_piso";
  } else {
    base = weightBaseMl;
    baseSource = "peso";
  }

  const physio = PHYSIO_BONUS[physioState] ?? 0;

  let climate = 0;
  if (tempC > 30) {
    climate += Math.round(tempC - 30) * 100;
  }

  const activity = Math.max(0, activityMinutes) * 12;

  let subtotal = base + physio + climate + activity;

  // Humedad alta + calor exige un extra proporcional al total ya calculado
  let humidityBonus = 0;
  if (tempC > 25 && humidityPct > 70) {
    humidityBonus = subtotal * 0.1;
  }

  const total = Math.round(subtotal + humidityBonus);

  return {
    total_ml: total,
    base_source: baseSource, // 'peso' | 'iom_edad' | 'iom_piso'
    iom_reference_ml: iomLiquidsMl,
    breakdown: {
      base_ml: Math.round(base),
      physio_ml: physio,
      climate_ml: Math.round(climate),
      activity_ml: Math.round(activity),
      humidity_bonus_ml: Math.round(humidityBonus),
    },
  };
}

module.exports = { calculateDailyGoal, PHYSIO_BONUS };
