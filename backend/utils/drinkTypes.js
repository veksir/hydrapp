/**
 * No toda bebida hidrata igual que el agua pura. Basado en la evidencia de
 * la investigación del usuario: el café SÍ cuenta como líquido (no
 * deshidrata significativamente), pero bebidas azucaradas/con cafeína alta
 * hidratan un poco menos por volumen que el agua pura. Nada de mitos tipo
 * "el café resta agua" — solo un descuento leve, no una resta.
 */
const DRINK_TYPES = [
  { id: "agua", label: "Agua", factor: 1.0 },
  { id: "bebida_deportiva", label: "Bebida deportiva", factor: 1.0 },
  { id: "leche", label: "Leche", factor: 1.0 },
  { id: "te", label: "Té", factor: 0.95 },
  { id: "cafe", label: "Café", factor: 0.95 },
  { id: "jugo", label: "Jugo", factor: 0.9 },
  { id: "refresco", label: "Refresco", factor: 0.85 },
];

const DRINK_TYPE_MAP = Object.fromEntries(DRINK_TYPES.map((d) => [d.id, d]));

function getDrinkFactor(drinkTypeId) {
  return DRINK_TYPE_MAP[drinkTypeId]?.factor ?? 1.0;
}

function isValidDrinkType(drinkTypeId) {
  return Object.prototype.hasOwnProperty.call(DRINK_TYPE_MAP, drinkTypeId);
}

module.exports = { DRINK_TYPES, getDrinkFactor, isValidDrinkType };
