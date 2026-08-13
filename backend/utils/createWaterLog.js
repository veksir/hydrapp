const db = require("../db/init");
const { getDrinkFactor, isValidDrinkType } = require("./drinkTypes");
const { getTodayGoalAndStatus } = require("./dailyStatus");
const { buildLogFeedback } = require("./logFeedback");
const { parseUtcTimestamp } = require("./time");

// Ningún ser humano toma más de esto de una sola vez — si pasa, es casi
// seguro un error de tipeo (ej. escribir 20000 en vez de 200). Mejor
// rechazarlo con un mensaje claro que dejarlo pasar en silencio.
const MAX_SINGLE_LOG_ML = 3000;

function isFiniteNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

/**
 * Registra un consumo de agua con toda la lógica estándar: valida el
 * recipiente (si viene), calcula el volumen efectivo por tipo de bebida,
 * inserta el log, y devuelve el feedback (ráfaga, cantidad de golpe,
 * sobrehidratación, cruce de meta). Centralizado acá porque tanto
 * POST /api/logs como la toma parcial de un recipiente grande
 * (POST /api/containers/:id/sip) necesitan exactamente lo mismo — antes
 * estaba duplicado, con el riesgo de corregir un bug en uno y olvidar el otro.
 */
function createWaterLog({ userId, profile, container_id, amount_ml, drink_type }) {
  const finalDrinkType = drink_type && isValidDrinkType(drink_type) ? drink_type : "agua";

  // Si viene container_id, SIEMPRE se valida que sea del usuario —
  // antes solo se validaba cuando no venía amount_ml, lo que permitía
  // referenciar recipientes de otros usuarios (IDOR) o un id inexistente
  // que terminaba tronando la restricción de llave foránea con un 500.
  let resolvedContainerId = null;
  let containerVolumeMl = null;
  if (container_id !== undefined && container_id !== null && container_id !== "") {
    const container = db
      .prepare("SELECT * FROM containers WHERE id = ? AND user_id = ?")
      .get(container_id, userId);
    if (!container) {
      const err = new Error("Recipiente no encontrado");
      err.status = 404;
      throw err;
    }
    resolvedContainerId = container.id;
    containerVolumeMl = Number(container.volume_ml);
    if (amount_ml === undefined || amount_ml === null || amount_ml === "") {
      amount_ml = container.volume_ml;
    }
  }

  let finalAmount = amount_ml;

  if (!isFiniteNumber(finalAmount) || Number(finalAmount) <= 0) {
    const err = new Error("amount_ml o container_id válido son requeridos");
    err.status = 400;
    throw err;
  }
  finalAmount = Number(finalAmount);

  // El límite de "un solo registro" es el volumen del recipiente cuando el
  // registro viene de un recipiente calibrado (ya validado como real, máx
  // 5000ml, al crearlo en /containers) — si no, un termo de 4L nunca se
  // podría registrar completo. Para montos manuales (sin recipiente), se
  // mantiene el tope fijo contra tipeos.
  const maxAllowedMl = containerVolumeMl != null ? containerVolumeMl : MAX_SINGLE_LOG_ML;
  if (finalAmount > maxAllowedMl) {
    const err = new Error(
      `${finalAmount}ml no es realista para un solo registro (máximo ${maxAllowedMl}ml). Si tomaste más, regístralo en varias veces.`
    );
    err.status = 400;
    throw err;
  }
  const effectiveAmount = Math.round(finalAmount * getDrinkFactor(finalDrinkType));

  // Estado ANTES de insertar, para poder decir "acabas de cruzar tu meta"
  const before = getTodayGoalAndStatus(userId, profile);

  const result = db
    .prepare(
      "INSERT INTO water_logs (user_id, container_id, amount_ml, drink_type, effective_ml) VALUES (?, ?, ?, ?, ?)"
    )
    .run(userId, resolvedContainerId, finalAmount, finalDrinkType, effectiveAmount);

  const log = db.prepare("SELECT * FROM water_logs WHERE id = ?").get(result.lastInsertRowid);

  const after = getTodayGoalAndStatus(userId, profile);

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

  return { log, feedback, consumedMl: after.consumedMl, goalMl: after.goal.total_ml };
}

module.exports = { createWaterLog, MAX_SINGLE_LOG_ML };
