import { useEffect, useState } from "react";
import { List, CalendarDays } from "lucide-react";
import { api } from "../api";
import HistoryCalendar from "../components/HistoryCalendar";
import HistoryChart from "../components/HistoryChart";
import { HistorySkeleton } from "../components/PageSkeletons";

const LIST_DAYS = 14;
const CALENDAR_DAYS = 90; // máximo que soporta el backend, permite navegar varios meses atrás

export default function History() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("calendar"); // "calendar" | "list"

  useEffect(() => {
    api.getHistory(CALENDAR_DAYS).then(setRows).finally(() => setLoading(false));
  }, []);

  if (loading) return <HistorySkeleton />;

  const hasAnyData = rows.some((r) => r.entries > 0);
  const listRows = rows.slice(-LIST_DAYS);
  const displayListRows = listRows.slice().reverse(); // más reciente (hoy) primero
  const chartRows = rows.slice(-30); // últimos 30 días para que la línea no se sature

  return (
    <div className="history">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Últimos {view === "calendar" ? "3 meses" : `${LIST_DAYS} días`}</p>
          <h1>Tu historial</h1>
        </div>
      </header>

      {!hasAnyData ? (
        <p className="setup-hint">Todavía no hay registros. Empieza a tomar agua hoy para ver tu progreso aquí.</p>
      ) : (
        <>
          <div className="history__toggle">
            <button
              className={`history__toggle-btn ${view === "calendar" ? "history__toggle-btn--active" : ""}`}
              onClick={() => setView("calendar")}
            >
              <CalendarDays size={16} /> Calendario
            </button>
            <button
              className={`history__toggle-btn ${view === "list" ? "history__toggle-btn--active" : ""}`}
              onClick={() => setView("list")}
            >
              <List size={16} /> Lista
            </button>
          </div>

          {view === "calendar" ? (
            <>
              <p className="setup-hint">Cada día se colorea según el % de meta que cumpliste ese día. Toca un día para ver el detalle.</p>
              <HistoryCalendar rows={rows} />
              <HistoryChart rows={chartRows} />
            </>
          ) : (
            <>
              <p className="setup-hint">Cada barra muestra qué % de la meta de ESE día cumpliste (no el día con más consumo).</p>
              <div className="card history__chart">
                {displayListRows.map((r, i) => (
                  <div className={`history__row ${r.entries === 0 ? "history__row--empty" : ""}`} key={r.date}>
                    <span className="history__date">
                      {i === 0
                        ? "Hoy"
                        : new Date(r.date + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                    </span>
                    <div className="history__bar-track">
                      <div className="history__bar" style={{ width: `${Math.min(100, r.pct)}%` }} />
                      {r.pct > 100 && <div className="history__bar-overflow" style={{ width: `${Math.min(40, r.pct - 100)}%` }} />}
                    </div>
                    <span className="history__value">{r.entries === 0 ? "sin dato" : `${r.pct}%`}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
