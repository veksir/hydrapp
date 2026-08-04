import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="screen-center" style={{ flexDirection: "column", gap: 12 }}>
      <p style={{ fontWeight: 600, fontSize: 18 }}>Esta página no existe</p>
      <p>Puede que el enlace esté roto o la ruta esté mal escrita.</p>
      <Link to="/" className="btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
        Volver al inicio
      </Link>
    </div>
  );
}
