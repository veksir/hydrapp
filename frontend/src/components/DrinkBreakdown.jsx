import "./DrinkBreakdown.css";

// Lista de barras horizontales con el % que aportó cada tipo de bebida
// a la hidratación total (últimos 30 días, ml EFECTIVOS post-factor —
// ver backend/routes/insights.js). Sin librerías, mismo patrón visual
// que el resto de las barras de progreso de la app.
export default function DrinkBreakdown({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="card drink-breakdown">
      <p className="drink-breakdown__title">De dónde viene tu hidratación</p>
      <p className="drink-breakdown__sub">Últimos 30 días, en ml efectivos</p>
      <div className="drink-breakdown__list">
        {items.map((item) => (
          <div key={item.drink_type} className="drink-breakdown__row">
            <div className="drink-breakdown__row-header">
              <span className="drink-breakdown__label">{item.label}</span>
              <span className="drink-breakdown__pct">{item.pct}%</span>
            </div>
            <div className="drink-breakdown__track">
              <div className="drink-breakdown__fill" style={{ width: `${item.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
