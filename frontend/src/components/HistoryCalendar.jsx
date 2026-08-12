import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Droplets } from "lucide-react";
import BottomSheet from "./BottomSheet";
import "./HistoryCalendar.css";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

function toneForPct(entries, pct) {
  if (entries === 0) return "none";
  if (pct >= 80) return "success";
  if (pct >= 40) return "warning";
  return "danger";
}

// Construye la grilla del mes (semanas completas, lunes a domingo) a partir
// de los datos ya cargados (mapa fecha -> registro del día).
function buildMonthGrid(year, month, byDate) {
  const firstOfMonth = new Date(year, month, 1);
  // getDay(): 0=domingo..6=sábado. Queremos que la semana empiece en lunes.
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ day, dateStr, data: byDate.get(dateStr) || null });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

export default function HistoryCalendar({ rows }) {
  const byDate = useMemo(() => new Map(rows.map((r) => [r.date, r])), [rows]);

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(null);

  const oldestAvailable = rows.length ? rows[0].date : null;
  const canGoBack = !oldestAvailable || `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}` > oldestAvailable.slice(0, 7);
  const canGoForward = cursor.getFullYear() < today.getFullYear() || (cursor.getFullYear() === today.getFullYear() && cursor.getMonth() < today.getMonth());

  const grid = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth(), byDate), [cursor, byDate]);

  const monthLabel = cursor.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function changeMonth(delta) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  return (
    <div className="history-cal card">
      <div className="history-cal__header">
        <button className="history-cal__nav" onClick={() => changeMonth(-1)} disabled={!canGoBack} aria-label="Mes anterior">
          <ChevronLeft size={18} />
        </button>
        <span className="history-cal__month">{monthLabel}</span>
        <button className="history-cal__nav" onClick={() => changeMonth(1)} disabled={!canGoForward} aria-label="Mes siguiente">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="history-cal__weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="history-cal__grid">
        {grid.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} className="history-cal__cell history-cal__cell--blank" />;
          const entries = cell.data?.entries ?? 0;
          const pct = cell.data?.pct ?? 0;
          const tone = toneForPct(entries, pct);
          const isToday = cell.dateStr === todayStr;
          const isFuture = cell.dateStr > todayStr;
          return (
            <button
              key={cell.dateStr}
              className={`history-cal__cell history-cal__cell--${isFuture ? "future" : tone} ${isToday ? "history-cal__cell--today" : ""}`}
              disabled={isFuture}
              onClick={() => setSelected(cell)}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="history-cal__legend">
        <span><i className="history-cal__dot history-cal__dot--success" />80%+</span>
        <span><i className="history-cal__dot history-cal__dot--warning" />40-79%</span>
        <span><i className="history-cal__dot history-cal__dot--danger" />&lt;40%</span>
        <span><i className="history-cal__dot history-cal__dot--none" />Sin dato</span>
      </div>

      <BottomSheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={
          selected
            ? new Date(selected.dateStr + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })
            : ""
        }
      >
        {selected && (
          <div className="history-cal__detail">
            {selected.data && selected.data.entries > 0 ? (
              <>
                <div className="history-cal__detail-row">
                  <Droplets size={18} />
                  <span>
                    <strong>{selected.data.consumed_ml} ml</strong> de {selected.data.goal_ml} ml de meta
                  </span>
                </div>
                <div className="history-cal__bar-track">
                  <div
                    className="history-cal__bar"
                    style={{ width: `${Math.min(100, selected.data.pct)}%` }}
                  />
                </div>
                <p className="history-cal__detail-sub">
                  {selected.data.pct}% de la meta · {selected.data.entries} registro{selected.data.entries === 1 ? "" : "s"}
                </p>
              </>
            ) : (
              <p className="setup-hint">Sin registros ese día.</p>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
