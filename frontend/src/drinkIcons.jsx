import { Droplet, Zap, Milk, Leaf, Coffee, CupSoda, GlassWater } from "lucide-react";

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
