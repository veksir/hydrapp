import { Droplet, Zap, Milk, Leaf, Coffee, CupSoda, GlassWater } from "lucide-react";

// Espejo de backend/utils/drinkTypes.js — id, label y factor de hidratación.
// Vive acá para que el formulario de recipientes (que no hace fetch de
// drinkTypes) pueda mostrar el selector de "contenido" del tarro.
export const DRINK_TYPES = [
  { id: "agua", label: "Agua", factor: 1.0 },
  { id: "bebida_deportiva", label: "Bebida deportiva", factor: 1.0 },
  { id: "leche", label: "Leche", factor: 1.0 },
  { id: "te", label: "Té", factor: 0.95 },
  { id: "cafe", label: "Café", factor: 0.95 },
  { id: "jugo", label: "Jugo", factor: 0.9 },
  { id: "refresco", label: "Refresco", factor: 0.85 },
];

export const DRINK_ICON_COMPONENTS = {
  agua: Droplet,
  bebida_deportiva: Zap,
  leche: Milk,
  te: Leaf,
  cafe: Coffee,
  jugo: CupSoda,
  refresco: GlassWater,
};

export function DrinkIcon({ type, size = 18, className }) {
  const Icon = DRINK_ICON_COMPONENTS[type] || Droplet;
  return <Icon size={size} className={className} strokeWidth={2} />;
}
