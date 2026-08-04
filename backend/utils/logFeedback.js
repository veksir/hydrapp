/**
 * Cada vez que el usuario registra un consumo, la app debe reaccionar —
 * no solo guardar el dato en silencio. Esto aplica directamente los
 * conceptos de la base científica: la sobrehidratación es real y sus
 * síntomas se parecen a los de deshidratación, y tomar mucha agua de
 * golpe no se absorbe igual que tomarla distribuida.
 */

function buildLogFeedback({
  amountJustLoggedMl,
  consumedTodayMl,
  goalMl,
  previousConsumedTodayMl,
  recentBurstMl = amountJustLoggedMl,
  recentBurstMinutes = 0,
}) {
  // 0. Ráfaga: mucho volumen en pocos minutos, sin importar que cada
  // registro individual haya sido "normal". Tomar 4-5 registros de 500-750ml
  // en 2 minutos no dispara el aviso de "de golpe" (cada uno es <700ml) pero
  // sigue siendo el mismo riesgo real de hiponatremia — hay que mirar la
  // velocidad acumulada, no solo cada evento aislado.
  if (recentBurstMl >= 2500) {
    return {
      level: "danger",
      message: `Llevas ${Math.round(recentBurstMl)}ml en los últimos ${Math.max(1, recentBurstMinutes)} minutos. Eso es demasiado rápido — para y espera al menos 20-30 minutos antes de seguir tomando agua.`,
    };
  }
  if (recentBurstMl >= 1200) {
    return {
      level: "danger",
      message: `Llevas ${Math.round(recentBurstMl)}ml en muy poco tiempo. Tomar mucho líquido muy rápido puede diluir el sodio en tu cuerpo (hiponatremia) — baja el ritmo.`,
    };
  }

  // 1. Cantidad de una sola vez, escalada por qué tan extrema es.
  if (amountJustLoggedMl >= 1200) {
    return {
      level: "danger",
      message:
        "Eso es una cantidad grande para tomarla de una sola vez. Tomar mucho líquido muy rápido puede diluir el sodio en tu cuerpo (hiponatremia) — reparte el resto en sorbos a lo largo de un rato.",
    };
  }
  if (amountJustLoggedMl >= 700) {
    return {
      level: "warning",
      message:
        "Eso es bastante de una sola vez. El cuerpo absorbe mejor el agua en sorbos distribuidos a lo largo del día que en una sola toma grande.",
    };
  }

  const ratio = goalMl > 0 ? consumedTodayMl / goalMl : 0;
  const previousRatio = goalMl > 0 ? previousConsumedTodayMl / goalMl : 0;

  // 2. Sobrehidratación: ya muy por encima de la meta del día, escalada.
  if (ratio >= 2.5) {
    return {
      level: "danger",
      message:
        "Ya llevas más del doble de tu meta de hoy. Detén el agua pura por ahora — si sientes náuseas, confusión o dolor de cabeza, esos también son síntomas de exceso de agua, no solo de falta.",
    };
  }
  if (ratio >= 1.5) {
    return {
      level: "warning",
      message:
        "Ya llevas bastante más de tu meta de hoy. Más agua no siempre es mejor: sin suficientes electrolitos, un exceso puede darte síntomas parecidos a los de la deshidratación (fatiga, náuseas, confusión). Considera pausar el agua pura por ahora.",
    };
  }

  // 3. Acaba de cruzar el 100% de su meta por primera vez hoy
  if (previousRatio < 1 && ratio >= 1) {
    return {
      level: "success",
      message: "¡Llegaste a tu meta de hoy! Puedes seguir tomando agua con moderación si tienes sed.",
    };
  }

  // 4. Meta llegando a 3/4, ánimo neutro
  if (previousRatio < 0.75 && ratio >= 0.75) {
    return { level: "info", message: "Vas en buen camino, ya llevas 3/4 de tu meta de hoy." };
  }

  return { level: null, message: null };
}

module.exports = { buildLogFeedback };
