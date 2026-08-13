import "./ConfirmDialog.css";

// Confirmación propia de la app (en vez del window.confirm del navegador,
// que rompe el estilo y el idioma del producto). Mismo patrón visual que
// CenterAlert: backdrop oscuro + tarjeta centrada.
export default function ConfirmDialog({ open, title, message, confirmLabel = "Eliminar", cancelLabel = "Cancelar", tone = "danger", onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="confirm-dialog__backdrop" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={title}>
        <h3 className="confirm-dialog__title">{title}</h3>
        {message && <p className="confirm-dialog__message">{message}</p>}
        <div className="confirm-dialog__actions">
          <button className="btn-ghost confirm-dialog__cancel" onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button className={`btn-primary confirm-dialog__confirm confirm-dialog__confirm--${tone}`} onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
