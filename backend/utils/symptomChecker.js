/**
 * Chequeo de síntomas — NO es un diagnóstico médico. Es orientación
 * educativa que cruza los síntomas reportados con el ritmo de consumo
 * de hoy, porque deshidratación y sobrehidratación comparten casi los
 * mismos síntomas y la app debe ayudar a distinguir cuál es más probable.
 */

const SYMPTOM_CATALOG = [
  { id: "mala_concentracion", label: "Mala concentración" },
  { id: "fatiga", label: "Fatiga o cansancio" },
  { id: "mal_humor", label: "Mal humor o ansiedad" },
  { id: "dolor_cabeza", label: "Dolor de cabeza" },
  { id: "nauseas", label: "Náuseas" },
  { id: "letargo", label: "Letargo o desorientación" },
  { id: "confusion", label: "Confusión" },
  { id: "orina_oscura", label: "Orina de color oscuro" },
];

const SEVERE_IDS = ["letargo", "confusion", "nauseas"];
const DEHYDRATION_SPECIFIC_IDS = ["orina_oscura"];

function assessSymptoms({ symptomIds = [], consumedMl = 0, goalMl = 1, hydrationStatus }) {
  if (!symptomIds.length) {
    return {
      category: "sin_sintomas",
      message: "No reportaste síntomas. Sigue tu ritmo habitual de hoy.",
      severe: false,
      safety_note: null,
    };
  }

  const ratio = goalMl > 0 ? consumedMl / goalMl : 0;
  const hasSevere = symptomIds.some((id) => SEVERE_IDS.includes(id));
  const hasDehydrationSpecific = symptomIds.some((id) => DEHYDRATION_SPECIFIC_IDS.includes(id));
  const behindPace = hydrationStatus === "atrasado" || hydrationStatus === "muy_atrasado";
  const wayOverGoal = ratio > 1.3;

  let category;
  let message;

  if (hasDehydrationSpecific || (behindPace && !wayOverGoal)) {
    category = "posible_deshidratacion";
    message =
      "Tus síntomas y tu ritmo de consumo de hoy apuntan más a deshidratación. Toma agua ahora, de a sorbos, y revisa el color de tu orina en la próxima hora: claro o amarillo pálido es buena señal.";
  } else if (wayOverGoal && !hasDehydrationSpecific) {
    category = "posible_sobrehidratacion";
    message =
      "Ya llevas bastante más de tu meta de hoy y tus síntomas también pueden indicar exceso de agua sin suficientes electrolitos. Pausa el agua pura por ahora; una comida o algo con electrolitos puede ayudar más que más agua.";
  } else {
    category = "ambiguo";
    message =
      "Estos síntomas pueden ser tanto de falta como de exceso de agua — se parecen mucho entre sí. El mejor indicador casero es el color de tu orina: claro/amarillo pálido sugiere buena hidratación, oscuro sugiere que te falta agua.";
  }

  const safetyNote = hasSevere
    ? "Esto no es un diagnóstico médico. Si la confusión, el letargo o las náuseas son intensos o no mejoran, busca atención médica."
    : "Esto no es un diagnóstico médico — es orientación general basada en lo que reportaste.";

  return { category, message, severe: hasSevere, safety_note: safetyNote };
}

module.exports = { SYMPTOM_CATALOG, assessSymptoms };
