import { useEffect } from "react";
import "./CenterAlert.css";

// Los avisos importantes (advertencia/peligro) se quedan hasta que el
// usuario los cierre a mano — no queremos que un aviso de sobrehidratación
// desaparezca antes de que le dé tiempo a leerlo. Los mensajes leves
// (felicitación, "vas en buen camino") sí pueden cerrarse solos para no
// agregar fricción al flujo de registro en dos toques.
const AUTO_DISMISS_MS = { success: 2600, info: 3000, warning: null, danger: null };

export default function CenterAlert({ feedback, onClose }) {
  useEffect(() => {
    if (!feedback) return;
    const ms = AUTO_DISMISS_MS[feedback.level];
    if (!ms) return;
    const t = setTimeout(onClose, ms);
    return () => clearTimeout(t);
  }, [feedback, onClose]);

  if (!feedback) return null;

  const icon = { success: "✓", info: "ℹ", warning: "⚠", danger: "⚠" }[feedback.level] || "ℹ";

  return (
    <div className="center-alert__backdrop" onClick={onClose}>
      <div className={`center-alert center-alert--${feedback.level}`} onClick={(e) => e.stopPropagation()}>
        <span className="center-alert__icon">{icon}</span>
        <p>{feedback.message}</p>
        <button className="center-alert__dismiss" onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
  );
}
