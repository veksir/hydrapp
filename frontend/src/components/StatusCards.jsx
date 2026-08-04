import { Brain, HeartPulse, Thermometer, Footprints } from "lucide-react";
import "./StatusCards.css";

const CONCENTRATION_BY_STATUS = {
  ok: { label: "Buena", tone: "success" },
  adelantado: { label: "Excelente", tone: "success" },
  atrasado: { label: "Regular", tone: "warning" },
  muy_atrasado: { label: "Baja", tone: "danger" },
};

const PERFORMANCE_BY_STATUS = {
  ok: { label: "Bueno", tone: "success" },
  adelantado: { label: "Óptimo", tone: "success" },
  atrasado: { label: "Bueno", tone: "warning" },
  muy_atrasado: { label: "Reducido", tone: "danger" },
};

export default function StatusCards({ hydrationStatus, tempC, climateBonusMl, activityMinutes, activityIsLive, onActivityClick }) {
  const concentration = CONCENTRATION_BY_STATUS[hydrationStatus] || CONCENTRATION_BY_STATUS.ok;
  const performance = PERFORMANCE_BY_STATUS[hydrationStatus] || PERFORMANCE_BY_STATUS.ok;

  const cards = [
    { icon: Brain, label: "Concentración (estimada)", value: concentration.label, tone: concentration.tone },
    { icon: HeartPulse, label: "Rendimiento físico", value: performance.label, tone: performance.tone },
    {
      icon: Thermometer,
      label: "Clima",
      value: `${Math.round(tempC)}°C`,
      sub: climateBonusMl > 0 ? "Meta aumentada" : null,
      tone: climateBonusMl > 0 ? "warning" : "neutral",
    },
    {
      icon: Footprints,
      label: "Actividad",
      value: activityMinutes > 0 ? `${activityMinutes} min` : "Sin registrar",
      sub: activityIsLive ? "Hoy" : "Toca para registrar",
      tone: activityIsLive ? "success" : "neutral",
      onClick: onActivityClick,
    },
  ];

  return (
    <div className="status-cards">
      {cards.map((c) =>
        c.onClick ? (
          <button key={c.label} className={`status-card status-card--${c.tone} status-card--clickable`} onClick={c.onClick}>
            <span className="status-card__icon"><c.icon size={18} /></span>
            <div>
              <p className="status-card__label">{c.label}</p>
              <p className="status-card__value">{c.value}</p>
              {c.sub && <p className="status-card__sub">{c.sub}</p>}
            </div>
          </button>
        ) : (
          <div key={c.label} className={`status-card status-card--${c.tone}`}>
            <span className="status-card__icon"><c.icon size={18} /></span>
            <div>
              <p className="status-card__label">{c.label}</p>
              <p className="status-card__value">{c.value}</p>
              {c.sub && <p className="status-card__sub">{c.sub}</p>}
            </div>
          </div>
        )
      )}
    </div>
  );
}
