/**
 * Tabla de ingesta adecuada de agua del Instituto de Medicina (IOM, EE. UU.).
 * Usamos la columna "solo líquidos" porque la app registra bebidas, no la
 * fracción de agua que viene de los alimentos.
 *
 * Se usa de dos formas:
 * 1. Para menores de 19 años: es la base directa (la fórmula ml/kg no está
 *    validada para niños/adolescentes, así que no se usa peso x 35 ahí).
 * 2. Para adultos (19+): actúa como un PISO — si peso x 35 da un número
 *    menor al mínimo IOM para su sexo, se usa el mínimo IOM en su lugar.
 */

const IOM_LIQUIDS_ML = [
  { minAge: 1, maxAge: 3, sex: "ANY", liquidsMl: 900 },
  { minAge: 4, maxAge: 8, sex: "ANY", liquidsMl: 1200 },
  { minAge: 9, maxAge: 13, sex: "M", liquidsMl: 1800 },
  { minAge: 9, maxAge: 13, sex: "F", liquidsMl: 1600 },
  { minAge: 14, maxAge: 18, sex: "M", liquidsMl: 2600 },
  { minAge: 14, maxAge: 18, sex: "F", liquidsMl: 1800 },
  { minAge: 19, maxAge: 200, sex: "M", liquidsMl: 3000 },
  { minAge: 19, maxAge: 200, sex: "F", liquidsMl: 2200 },
];

function getIomLiquidsMl(ageYears, sex) {
  if (!ageYears || ageYears < 1) return null;
  const row = IOM_LIQUIDS_ML.find(
    (r) => ageYears >= r.minAge && ageYears <= r.maxAge && (r.sex === "ANY" || r.sex === sex)
  );
  return row ? row.liquidsMl : null;
}

function isMinor(ageYears) {
  return ageYears != null && ageYears < 19;
}

module.exports = { getIomLiquidsMl, isMinor, IOM_LIQUIDS_ML };
