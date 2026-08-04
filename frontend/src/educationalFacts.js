export const EDUCATIONAL_FACTS = [
  "La sensación de sed aparece cuando ya perdiste 1-2% de tu agua corporal — cuando sientes sed, ya estás levemente deshidratado.",
  "Una persona de 68kg puede perder 1-1.5kg de agua solo con el día a día, sin hacer ejercicio — suficiente para afectar la concentración.",
  "El café sí cuenta como líquido: contrario al mito popular, no deshidrata de forma significativa.",
  "El color de la orina es tu mejor indicador casero: claro o amarillo pálido es buena señal, oscuro significa que necesitas agua ahora.",
  "En mujeres, perder 1-2% de agua corporal afecta el vigor y el ánimo incluso antes de sentir sed o cansancio físico.",
  "Rehidratarte no basta de inmediato: los efectos en el ánimo pueden persistir un rato después. Mejor mantenerte hidratado que recuperarte.",
  "El adulto promedio toma solo ~1 litro de agua al día — la mitad de lo recomendado.",
  "Tus músculos son 70-75% agua; por eso la deshidratación se siente como fatiga física, no solo mental.",
  "La cognición ya se resiente desde el 1% de pérdida de agua corporal, no solo desde el 2% como se creía antes.",
  "Más agua no siempre es mejor: sin suficientes electrolitos, un exceso puede dar síntomas parecidos a los de la deshidratación.",
];

// Una cápsula distinta cada día del año, determinística (no aleatoria en
// cada render) para que se sienta como contenido cuidado, no ruido.
export function factOfTheDay(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);
  return EDUCATIONAL_FACTS[dayOfYear % EDUCATIONAL_FACTS.length];
}
