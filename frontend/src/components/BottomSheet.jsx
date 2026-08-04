import { useEffect } from "react";
import "./BottomSheet.css";

export default function BottomSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="bottom-sheet__backdrop" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet__handle" />
        {title && <h2 className="bottom-sheet__title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
