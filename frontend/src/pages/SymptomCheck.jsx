import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const CATEGORY_STYLES = {
  sin_sintomas: "ok",
  posible_deshidratacion: "alert",
  posible_sobrehidratacion: "warn",
  ambiguo: "warn",
};

const CATEGORY_TITLES = {
  sin_sintomas: "Todo tranquilo",
  posible_deshidratacion: "Posible deshidratación",
  posible_sobrehidratacion: "Posible exceso de agua",
  ambiguo: "No está claro todavía",
};

export default function SymptomCheck() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getSymptomCatalog().then(setCatalog).catch((err) => setError(err.message));
  }, []);

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      const res = await api.checkSymptoms(selected);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const tone = CATEGORY_STYLES[result.assessment.category] || "warn";
    return (
      <div className="symptom-screen">
        <header className="dashboard__header">
          <h1>Resultado</h1>
        </header>
        <div className={`card symptom-result symptom-result--${tone}`}>
          <span className={`status-pill status-pill--${tone}`}>{CATEGORY_TITLES[result.assessment.category]}</span>
          <p className="symptom-result__message">{result.assessment.message}</p>
          <p className="symptom-result__stats">
            Hoy llevas {Math.round(result.consumed_ml)}ml de tu meta de {Math.round(result.goal_ml)}ml
          </p>
          {result.assessment.safety_note && (
            <p className="symptom-result__safety">{result.assessment.safety_note}</p>
          )}
        </div>
        <button
          className="btn-ghost"
          onClick={() => {
            setResult(null);
            setSelected([]);
          }}
        >
          Volver a evaluar
        </button>
        <button className="btn-primary" onClick={() => navigate("/")}>
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="symptom-screen">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Cómo te sientes</p>
          <h1>¿Tienes alguno de estos síntomas?</h1>
        </div>
      </header>

      <p className="setup-hint">
        Marca lo que sientas ahora. Esto no reemplaza atención médica — cruzamos tus síntomas con
        cuánta agua llevas hoy para orientarte mejor.
      </p>

      <div className="card symptom-list">
        {catalog.map((s) => (
          <label key={s.id} className="symptom-item">
            <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
            <span>{s.label}</span>
          </label>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
        {loading ? "Evaluando..." : selected.length === 0 ? "No tengo síntomas, solo revisar" : "Evaluar"}
      </button>
    </div>
  );
}
