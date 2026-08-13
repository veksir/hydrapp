import { useEffect, useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import { DrinkIcon } from "../drinkIcons";
import LargeContainerCard from "./LargeContainerCard";
import "./LogDrinkSheet.css";

const QUICK_AMOUNTS = [250, 350, 500, 750, 1000];

// Un recipiente se registra por tomas parciales si el usuario lo marcó como
// termo/jarra/botellón (container_type) sin importar su volumen — un termo
// chico también se vacía de a sorbos — o si es grande (>3000ml) aunque no
// tenga tipo asignado (recipientes migrados de antes del feature).
function usesSipFlow(container) {
  return (
    (container.container_type && container.container_type !== "custom") ||
    Number(container.volume_ml) > 3000
  );
}

export default function LogDrinkSheet({ open, onClose, drinkTypes, containers, onSubmit, onSip, onRefill, submitting }) {
  const [step, setStep] = useState(1);
  const [drinkType, setDrinkType] = useState("agua");
  const [customAmount, setCustomAmount] = useState("");
  const [customError, setCustomError] = useState("");
  const [activeContainerId, setActiveContainerId] = useState(null);
  const sheetContentRef = useRef(null);

  // Al abrir el sheet o cambiar de paso, el scroll se recoloca arriba: si el
  // paso anterior era largo (muchos recipientes) y el usuario iba abajo, el
  // paso nuevo renderizaría "corrido" a la altura del scroll anterior.
  useEffect(() => {
    if (sheetContentRef.current) sheetContentRef.current.scrollTop = 0;
  }, [open, step]);

  // Se deriva del prop containers (no de un snapshot) para que, tras una
  // toma parcial o rellenado, el nivel de líquido de la tarjeta refleje el
  // current_volume actualizado que devuelve el re-fetch.
  const activeContainer = containers.find((c) => c.id === activeContainerId) || null;

  function reset() {
    setStep(1);
    setDrinkType("agua");
    setCustomAmount("");
    setCustomError("");
    setActiveContainerId(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pickDrink(id) {
    setDrinkType(id);
    setStep(2);
  }

  async function pickAmount(ml) {
    await onSubmit({ drink_type: drinkType, amount_ml: ml });
    handleClose();
  }

  // Los termos/jarras/botellones (y cualquier recipiente grande) NO se
  // registran de una sola vez: abren la sección de toma parcial con su nivel
  // de líquido restante. El contenido lo define el propio recipiente.
  function pickContainer(container) {
    if (usesSipFlow(container)) {
      setActiveContainerId(container.id);
      setStep(3);
      return;
    }
    onSubmit({ drink_type: drinkType, container_id: container.id });
    handleClose();
  }

  async function submitCustom(e) {
    e.preventDefault();
    const ml = Number(customAmount);
    if (!customAmount || !Number.isFinite(ml) || ml <= 0) {
      setCustomError("Escribe una cantidad válida en ml");
      return;
    }
    setCustomError("");
    await onSubmit({ drink_type: drinkType, amount_ml: ml });
    handleClose();
  }

  const title = step === 1 ? "¿Qué tomaste?" : step === 2 ? "¿Cuánto?" : activeContainer?.name || "Toma parcial";

  // Los recipientes con tomas parciales (termos/jarras/botellones) se acceden
  // directo desde el primer paso — no tiene sentido obligar a elegir una
  // bebida para después elegir recipiente. Los de toque rápido (vaso normal)
  // siguen en el paso de cantidad.
  const sipContainers = containers.filter(usesSipFlow);
  const quickContainers = containers.filter((c) => !usesSipFlow(c));

  return (
    <BottomSheet open={open} onClose={handleClose} title={title} contentRef={sheetContentRef}>
      {step === 1 && (
        <>
          {sipContainers.length > 0 && (
            <div className="amount-section">
              <p className="amount-section__label">Tus recipientes</p>
              <ul className="sip-container-list">
                {sipContainers.map((c) => {
                  const level = Number(c.volume_ml) > 0
                    ? Math.max(0, Math.min(100, (Number(c.current_volume ?? c.volume_ml) / Number(c.volume_ml)) * 100))
                    : 0;
                  return (
                    <li key={c.id}>
                      <button className="sip-container-row" disabled={submitting} onClick={() => pickContainer(c)}>
                        <span className="sip-container-row__main">
                          <span className="sip-container-row__name">{c.name}</span>
                          <span className="sip-container-row__vol">{c.volume_ml}ml · toma parcial</span>
                        </span>
                        <span className="sip-container-row__level">
                          <span className="sip-container-row__fill" style={{ height: `${level}%` }} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="drink-grid">
            {drinkTypes.map((d) => (
              <button key={d.id} className="drink-option" onClick={() => pickDrink(d.id)}>
                <span className="drink-option__icon"><DrinkIcon type={d.id} size={24} /></span>
                <span>{d.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <div className="amount-picker">
          <button className="btn-ghost amount-picker__back" onClick={() => setStep(1)}>
            ← Cambiar bebida
          </button>

          {(() => {
            const selected = drinkTypes.find((d) => d.id === drinkType);
            if (selected && selected.factor < 1) {
              return (
                <p className="amount-factor-hint">
                  {selected.label} hidrata al {Math.round(selected.factor * 100)}% del agua pura — por
                  ejemplo, 500ml cuentan como {Math.round(500 * selected.factor)}ml para tu meta.
                </p>
              );
            }
            return null;
          })()}

          {quickContainers.length > 0 && (
            <div className="amount-section">
              <p className="amount-section__label">Tus recipientes calibrados</p>
              <div className="container-quick-grid">
                {quickContainers.map((c) => (
                  <button
                    key={c.id}
                    className="container-quick-option"
                    disabled={submitting}
                    onClick={() => pickContainer(c)}
                  >
                    <span className="container-quick-option__name">{c.name}</span>
                    <span className="container-quick-option__vol">{c.volume_ml}ml</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="amount-section">
            <p className="amount-section__label">Cantidades rápidas</p>
            <div className="amount-grid">
              {QUICK_AMOUNTS.map((ml) => (
                <button key={ml} className="amount-option" disabled={submitting} onClick={() => pickAmount(ml)}>
                  {ml}ml
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={submitCustom} className="amount-custom-wrap">
            <div className="amount-custom">
              <input
                type="number"
                min="1"
                placeholder="Otro (ml)"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setCustomError("");
                }}
              />
              <button className="btn-primary" type="submit" disabled={submitting}>
                Registrar
              </button>
            </div>
            {customError && <p className="error-text">{customError}</p>}
          </form>
        </div>
      )}

      {step === 3 && (
        <div className="amount-picker">
          <button className="btn-ghost amount-picker__back" onClick={() => setStep(1)}>
            ← Volver
          </button>

          <LargeContainerCard
            container={activeContainer}
            onSip={(amountMl) => onSip({ container_id: activeContainer.id, amount_ml: amountMl, drink_type: activeContainer.drink_type })}
            onRefill={onRefill}
            submitting={submitting}
          />
        </div>
      )}
    </BottomSheet>
  );
}