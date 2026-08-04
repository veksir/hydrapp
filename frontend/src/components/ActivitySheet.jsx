import { useState } from "react";
import BottomSheet from "./BottomSheet";

const QUICK_MINUTES = [0, 15, 30, 45, 60, 90];

export default function ActivitySheet({ open, onClose, currentMinutes, onSubmit, submitting }) {
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState("");

  async function pick(minutes) {
    await onSubmit(minutes);
    onClose();
  }

  async function submitCustom(e) {
    e.preventDefault();
    const minutes = Number(custom);
    if (!custom || !Number.isFinite(minutes) || minutes < 0) {
      setCustomError("Escribe un número de minutos válido");
      return;
    }
    setCustomError("");
    await onSubmit(minutes);
    setCustom("");
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="¿Cuánto ejercicio hiciste hoy?">
      <p className="setup-hint">
        Actualmente: {currentMinutes > 0 ? `${currentMinutes} minutos` : "nada registrado hoy"}. Esto ajusta tu
        meta de hidratación del día.
      </p>
      <div className="amount-grid">
        {QUICK_MINUTES.map((m) => (
          <button key={m} className="amount-option" disabled={submitting} onClick={() => pick(m)}>
            {m === 0 ? "Nada" : `${m} min`}
          </button>
        ))}
      </div>
      <form onSubmit={submitCustom} className="amount-custom-wrap">
        <div className="amount-custom">
          <input
            type="number"
            min="0"
            placeholder="Otro (min)"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setCustomError("");
            }}
          />
          <button className="btn-primary" type="submit" disabled={submitting}>
            Guardar
          </button>
        </div>
        {customError && <p className="error-text">{customError}</p>}
      </form>
    </BottomSheet>
  );
}
