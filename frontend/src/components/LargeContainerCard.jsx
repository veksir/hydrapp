import { useRef, useState } from "react";
import { Check, RefreshCw, Thermometer, GlassWater, Container } from "lucide-react";
import { DrinkIcon, DRINK_TYPES } from "../drinkIcons";
import "./LargeContainerCard.css";

const TYPE_ICONS = {
  thermos: Thermometer,
  pitcher: GlassWater,
  dispenser: Container,
  custom: Thermometer,
};

const QUICK_SIPS = [250, 500, 750];

// Tarjeta de un recipiente con seguimiento parcial (termo/jarra/botellón o
// >3000ml): muestra el nivel de líquido restante (con onda animada), permite
// rellenar y registrar tomas parciales. Cada toma descuenta del restante y
// entra por la lógica normal de logs (meta, factor de hidratación, ráfaga).
// El contenido es el propio del tarro (drink_type), no la selección global
// del sheet. Al registrar se muestra una confirmación inline en la misma
// tarjeta (en vez de un toast que tapa la animación del nivel bajando).
export default function LargeContainerCard({ container, onSip, onRefill, submitting }) {
  const capacity = Number(container.volume_ml) || 0;
  const remaining = Math.max(0, Number(container.current_volume ?? container.volume_ml) || 0);
  const pct = capacity > 0 ? Math.min(100, (remaining / capacity) * 100) : 0;
  const [amount, setAmount] = useState(Math.min(250, remaining));
  const [done, setDone] = useState(null);
  const doneTimer = useRef(null);

  // Si el restante bajó (toma previa), el monto seleccionado nunca puede
  // superarlo.
  const safeAmount = Math.min(amount, remaining);
  const TypeIcon = TYPE_ICONS[container.container_type] || Thermometer;
  const content = DRINK_TYPES.find((d) => d.id === container.drink_type) || DRINK_TYPES[0];

  // La confirmación vive DENTRO de los botones (Rellenar / Registrar) para
  // no agregar un elemento que empuje el layout hacia arriba y de nuevo
  // abajo. El botón mantiene su tamaño y solo cambia su contenido.
  function flash(action) {
    setDone(action);
    clearTimeout(doneTimer.current);
    doneTimer.current = setTimeout(() => setDone(null), 1500);
  }

  async function confirm() {
    if (safeAmount <= 0) return;
    await onSip(safeAmount);
    flash("Sip");
    const newRemaining = remaining - safeAmount;
    setAmount(newRemaining > 250 ? 250 : newRemaining >= 50 ? newRemaining : 50);
  }

  async function refill() {
    await onRefill(container.id);
    flash("Refill");
  }

  return (
    <div className="lcc">
      <div className="lcc__head">
        <span className="lcc__name">
          <TypeIcon size={16} className="lcc__type-icon" />
          {container.name}
        </span>
        <button
          className="btn-ghost btn-with-icon lcc__refill"
          onClick={refill}
          disabled={submitting || remaining >= capacity}
        >
          {done === "Refill" ? (
            <><Check size={14} /> Listo ✓</>
          ) : (
            <><RefreshCw size={14} /> Rellenar</>
          )}
        </button>
      </div>

      <div className="lcc__body">
        <div className="lcc__visual-col">
          <p className="lcc__section-tag">Restante</p>
          <div className={`lcc__visual lcc__visual--${container.container_type || "thermos"}`}>
            <div className="lcc__liquid" style={{ height: `${pct}%` }}>
              {pct > 0 && <span className="lcc__wave" />}
            </div>
            {pct === 0 && <p className="lcc__empty">Vacío</p>}
          </div>
          <p className="lcc__readout">
            <strong>{Math.round(remaining)}</strong> <span>/ {Math.round(capacity)} ml</span>
          </p>
        </div>

        <div className="lcc__controls">
          <div className="lcc__content-group">
            <p className="lcc__section-tag">Contenido</p>
            <span className="lcc__content-chip">
              <DrinkIcon type={content.id} size={14} />
              <span className="lcc__content-chip-label">{content.label}</span>
              {content.factor < 1 && (
                <span className="lcc__content-factor">hidrata al {Math.round(content.factor * 100)}%</span>
              )}
            </span>
          </div>

          <div className="lcc__controls-divider" />

          <div className="amount-section">
            <p className="amount-section__label">¿Cuánto tomaste?</p>
            <div className="amount-grid">
              {QUICK_SIPS.map((q) => (
                <button
                  key={q}
                  className={`amount-option ${safeAmount === q ? "amount-option--active" : ""}`}
                  disabled={submitting || q > remaining}
                  onClick={() => setAmount(q)}
                >
                  +{q}ml
                </button>
              ))}
            </div>

            <div className="lcc__slider-row">
              <input
                type="range"
                min="50"
                max={Math.max(50, remaining)}
                step="10"
                value={Math.min(safeAmount, Math.max(50, remaining))}
                onChange={(e) => setAmount(Number(e.target.value))}
                disabled={submitting || remaining <= 0}
              />
              <span className="lcc__slider-value">{Math.min(safeAmount, remaining) || 0}ml</span>
            </div>

            <button className="btn-primary lcc__confirm" onClick={confirm} disabled={submitting || safeAmount <= 0}>
              {done === "Sip" ? (
                <><Check size={14} /> Registrado ✓</>
              ) : submitting ? (
                "Registrando..."
              ) : (
                `Registrar ${safeAmount}ml`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}