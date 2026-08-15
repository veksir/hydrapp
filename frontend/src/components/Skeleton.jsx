// Bloque base para pantallas de carga (reemplaza los "Cargando..." de
// texto plano). Cada página compone estos bloques para armar una silueta
// aproximada de su propio layout — no hace falta un componente por
// página, solo unas piezas simples (línea, círculo, tarjeta) reutilizadas
// con distinto tamaño. Usa las variables de tema existentes, así que
// funciona igual en modo claro/oscuro sin código extra.
import "./Skeleton.css";

export function SkeletonBlock({ width, height = "16px", radius = "var(--radius-sm)", className = "", style }) {
  return (
    <div
      className={`skeleton-block ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCircle({ size = "24px", className = "", style }) {
  return (
    <div
      className={`skeleton-block ${className}`}
      style={{ width: size, height: size, borderRadius: "50%", ...style }}
      aria-hidden="true"
    />
  );
}

// Envuelve un grupo de bloques y anuncia el estado de carga una sola vez
// para lectores de pantalla, en vez de que cada bloque individual (que es
// puramente decorativo) sea anunciado por separado.
export function SkeletonGroup({ label = "Cargando", children, className = "" }) {
  return (
    <div className={`skeleton-group ${className}`} role="status" aria-label={label}>
      {children}
    </div>
  );
}
