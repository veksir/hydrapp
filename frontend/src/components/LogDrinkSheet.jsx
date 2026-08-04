import { useState } from "react";
import BottomSheet from "./BottomSheet";
import { DrinkIcon } from "../drinkIcons";
import "./LogDrinkSheet.css";

const QUICK_AMOUNTS = [250, 350, 500, 750, 1000];

export default function LogDrinkSheet({ open, onClose, drinkTypes, containers, onSubmit, submitting }) {
  const [step, setStep] = useState(1);
  const [drinkType, setDrinkType] = useState("agua");
  const [customAmount, setCustomAmount] = useState("");
  const [customError, setCustomError] = useState("");

  function reset() {
    setStep(1);
    setDrinkType("agua");
    setCustomAmount("");
    setCustomError("");
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

  async function pickContainer(container) {
    await onSubmit({ drink_type: drinkType, container_id: container.id });
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

  return (
    <BottomSheet open={open} onClose={handleClose} title={step === 1 ? "¿Qué tomaste?" : "¿Cuánto?"}>
      {step === 1 && (
        <div className="drink-grid">
          {drinkTypes.map((d) => (
            <button key={d.id} className="drink-option" onClick={() => pickDrink(d.id)}>
              <span className="drink-option__icon"><DrinkIcon type={d.id} size={24} /></span>
              <span>{d.label}</span>
            </button>
          ))}
        </div>
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

          {containers.length > 0 && (
            <div className="amount-section">
              <p className="amount-section__label">Tus recipientes calibrados</p>
              <div className="container-quick-grid">
                {containers.map((c) => (
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
    </BottomSheet>
  );
}
