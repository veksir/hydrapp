import { useEffect, useState } from "react";
import { api } from "../api";

export default function History() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHistory(14).then(setRows).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="screen-center">Cargando historial...</div>;

  const hasAnyData = rows.some((r) => r.entries > 0);

  return (
    <div className="history">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Últimos 14 días</p>
          <h1>Tu historial</h1>
        </div>
      </header>

      <p className="setup-hint">Cada barra muestra qué % de la meta de ESE día cumpliste (no el día con más consumo).</p>

      {!hasAnyData ? (
        <p className="setup-hint">Todavía no hay registros. Empieza a tomar agua hoy para ver tu progreso aquí.</p>
      ) : (
        <div className="card history__chart">
          {rows.map((r) => (
            <div className={`history__row ${r.entries === 0 ? "history__row--empty" : ""}`} key={r.date}>
              <span className="history__date">
                {new Date(r.date + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
              </span>
              <div className="history__bar-track">
                <div className="history__bar" style={{ width: `${Math.min(100, r.pct)}%` }} />
                {r.pct > 100 && <div className="history__bar-overflow" style={{ width: `${Math.min(40, r.pct - 100)}%` }} />}
              </div>
              <span className="history__value">{r.entries === 0 ? "sin dato" : `${r.pct}%`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
