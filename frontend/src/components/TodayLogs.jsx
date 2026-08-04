import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { DrinkIcon } from "../drinkIcons";
import "./TodayLogs.css";

const COLLAPSE_AFTER = 5;
const REMOVE_ANIM_MS = 240;

export default function TodayLogs({ logs, onDelete, highlightId }) {
  const navigate = useNavigate();
  const [removingIds, setRemovingIds] = useState(new Set());
  const [showAll, setShowAll] = useState(false);

  if (!logs.length) return null;

  const ordered = logs.slice().reverse();
  const visible = showAll ? ordered : ordered.slice(0, COLLAPSE_AFTER);
  const hiddenCount = ordered.length - visible.length;

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar este registro?")) return;
    setRemovingIds((prev) => new Set(prev).add(id));
    setTimeout(() => onDelete(id), REMOVE_ANIM_MS);
  }

  return (
    <section className="card today-logs">
      <h2>Hoy registraste</h2>
      <ul className="today-logs__list">
        {visible.map((log) => (
          <TodayLogRow
            key={log.id}
            log={log}
            isNew={log.id === highlightId}
            isRemoving={removingIds.has(log.id)}
            onDelete={() => handleDelete(log.id)}
          />
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button className="btn-ghost today-logs__more" onClick={() => setShowAll(true)}>
          Ver {hiddenCount} más
        </button>
      )}
      {ordered.length > COLLAPSE_AFTER && (
        <button className="btn-ghost today-logs__more" onClick={() => navigate("/historial")}>
          Ver historial completo
        </button>
      )}
    </section>
  );
}

function TodayLogRow({ log, isNew, isRemoving, onDelete }) {
  const [highlighted, setHighlighted] = useState(isNew);

  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => setHighlighted(false), 1100);
    return () => clearTimeout(t);
  }, [isNew]);

  return (
    <li
      className={`today-logs__item ${highlighted ? "today-logs__item--new" : ""} ${isRemoving ? "today-logs__item--removing" : ""}`}
    >
      <span className="today-logs__icon">
        <DrinkIcon type={log.drink_type} size={18} />
      </span>
      <div className="today-logs__info">
        <span className="today-logs__amount">{log.amount_ml}ml</span>
        <span className="today-logs__time">
          {new Date(log.logged_at.replace(" ", "T") + "Z").toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <button className="today-logs__delete" onClick={onDelete} aria-label="Eliminar registro">
        <Trash2 size={15} />
      </button>
    </li>
  );
}
