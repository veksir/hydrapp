const { parseUtcTimestamp } = require("./time");

/**
 * "Probabilidad de que aparezca la sed" — en vez de una alarma cada X
 * horas, mira cuánto suele durar el usuario entre trago y trago HOY, y
 * compara contra cuánto lleva ya sin tomar nada. Si se está acercando (o
 * ya pasó) su intervalo habitual, es un buen momento para avisar antes de
 * que la sed aparezca — que, según la ciencia, ya es una señal tardía.
 */

const WAKE_FALLBACK_GAP_MINUTES = 90; // si no hay suficiente historial de hoy

function predictThirst({ todayLogs, nowMs = Date.now() }) {
  if (!todayLogs.length) {
    return { likely: false, message: null, minutes_since_last: null, minutes_until_estimated: null };
  }

  const sorted = [...todayLogs].sort(
    (a, b) => parseUtcTimestamp(a.logged_at) - parseUtcTimestamp(b.logged_at)
  );

  const lastLogMs = parseUtcTimestamp(sorted[sorted.length - 1].logged_at);
  const minutesSinceLast = Math.round((nowMs - lastLogMs) / 60000);

  let avgGapMinutes = WAKE_FALLBACK_GAP_MINUTES;
  if (sorted.length >= 2) {
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((parseUtcTimestamp(sorted[i].logged_at) - parseUtcTimestamp(sorted[i - 1].logged_at)) / 60000);
    }
    avgGapMinutes = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  }

  const threshold = avgGapMinutes * 0.85;
  if (minutesSinceLast < threshold) {
    return { likely: false, message: null, minutes_since_last: minutesSinceLast, minutes_until_estimated: null };
  }

  const minutesUntil = Math.max(0, Math.round(avgGapMinutes - minutesSinceLast));
  const message =
    minutesUntil > 2
      ? `Según tu patrón, probablemente sentirás sed en unos ${minutesUntil} minutos. Buen momento para adelantarte.`
      : "Según tu patrón de hoy, ya deberías estar por sentir sed. Buen momento para tomar agua.";

  return { likely: true, message, minutes_since_last: minutesSinceLast, minutes_until_estimated: minutesUntil };
}

module.exports = { predictThirst };
