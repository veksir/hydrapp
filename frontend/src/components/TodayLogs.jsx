import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { DrinkIcon } from "../drinkIcons";
import ConfirmDialog from "./ConfirmDialog";
import "./TodayLogs.css";

const COLLAPSE_AFTER = 5;
const REMOVE_ANIM_MS = 240;

export default function TodayLogs({ logs, onDelete, highlightId }) {
  const navigate = useNavigate();
  const [removingIds, setRemovingIds] = useState(new Set());
  const [showAll, setShowAll] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  // Guard síncrono aparte del estado: evita que un doble click/tap deje un
  // segundo handleDelete(id) encolado que se ejecuta antes de que el
  // re-render con removingIds se aplique.
  const removingRef = useRef(new Set());

  if (!logs.length) return null;

  const ordered = logs.slice().reverse();
  const visible = showAll ? ordered : ordered.slice(0, COLLAPSE_AFTER);
  const hiddenCount = ordered.length - visible.length;

  // El diálogo de confirmación propio reemplaza al window.confirm() del
  // navegador (estilo + idioma del producto). La fila solo se marca como
  // "removiendo" cuando el usuario confirma en el diálogo.
  function askDelete(id) {
    if (removingRef.current.has(id)) return;
    setPendingId(id);
  }

  async function handleDelete(id) {
    if (removingRef.current.has(id)) return;
    removingRef.current.add(id);
    setRemovingIds((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      try {
        await onDelete(id);
        // Éxito: el log va a desaparecer de `logs` en el próximo render
        // (viene del padre tras recargar), no hace falta limpiar el guard
        // a mano — igual lo dejamos, ese id ya no debería volver a existir.
      } catch {
        // Falló el borrado real: liberar el guard para permitir reintentar
        // en vez de dejar la fila trabada para siempre.
        removingRef.current.delete(id);
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }, REMOVE_ANIM_MS);
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
            onDelete={() => askDelete(log.id)}
          />
        ))}
      </ul>
      <ConfirmDialog
        open={pendingId !== null}
        title="¿Eliminar este registro?"
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        onCancel={() => setPendingId(null)}
        onConfirm={() => {
          const id = pendingId;
          setPendingId(null);
          handleDelete(id);
        }}
      />
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
      <button
        className="today-logs__delete"
        onClick={onDelete}
        disabled={isRemoving}
        aria-label="Eliminar registro"
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}
