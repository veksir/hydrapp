import "./WeekdayPatternChart.css";

const WIDTH = 320;
const HEIGHT = 150;
const PAD_X = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

// A diferencia de Historial (cronológico, "¿qué pasó el día X?"), esto
// responde una pregunta que solo se puede contestar agregando muchos
// días: "en promedio, ¿qué día de la semana tomo menos?". El backend
// (ver insights.js) ya filtra los días con muy poca muestra — acá solo
// se dibuja lo que llega.
//
// Color por barra: mismo criterio de 3 niveles que ya usa
// HistoryCalendar (≥80% éxito, 40-79% alerta, <40% riesgo) — antes esta
// gráfica usaba un binario verde/gris que no seguía esa convención.
function tone(pct) {
  if (pct >= 80) return "success";
  if (pct >= 40) return "warning";
  return "danger";
}

export default function WeekdayPatternChart({ days }) {
  if (!days || days.length === 0) return null;

  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = innerW / days.length;
  const barWidth = Math.min(28, step * 0.55);
  const maxPct = Math.max(100, ...days.filter((d) => d.avg_pct !== null).map((d) => d.avg_pct));

  function y(pct) {
    return PAD_TOP + innerH - (pct / maxPct) * innerH;
  }
  const goalY = y(100);

  return (
    <div className="weekday-pattern-chart card">
      <p className="weekday-pattern-chart__title">¿Qué días tomás menos?</p>
      <p className="weekday-pattern-chart__sub">Promedio de los últimos 30 días por día de la semana</p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="weekday-pattern-chart__svg">
        <line x1={PAD_X} y1={goalY} x2={WIDTH - PAD_X} y2={goalY} className="weekday-pattern-chart__goal-line" />
        {days.map((d, i) => {
          const cx = PAD_X + step * i + step / 2;
          const hasData = d.avg_pct !== null;
          return (
            <g key={d.weekday}>
              {hasData ? (
                <rect
                  x={cx - barWidth / 2}
                  y={y(d.avg_pct)}
                  width={barWidth}
                  height={Math.max(innerH - (y(d.avg_pct) - PAD_TOP), 1)}
                  rx={4}
                  className={`weekday-pattern-chart__bar weekday-pattern-chart__bar--${tone(d.avg_pct)}`}
                />
              ) : (
                <circle cx={cx} cy={HEIGHT - PAD_BOTTOM + 8} r={2} className="weekday-pattern-chart__empty-dot" />
              )}
              <text x={cx} y={HEIGHT - 6} className="weekday-pattern-chart__day-label">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="weekday-pattern-chart__legend">
        <span className="weekday-pattern-chart__legend-item">
          <span className="weekday-pattern-chart__legend-dot weekday-pattern-chart__legend-dot--success" />80%+
        </span>
        <span className="weekday-pattern-chart__legend-item">
          <span className="weekday-pattern-chart__legend-dot weekday-pattern-chart__legend-dot--warning" />40-79%
        </span>
        <span className="weekday-pattern-chart__legend-item">
          <span className="weekday-pattern-chart__legend-dot weekday-pattern-chart__legend-dot--danger" />&lt;40%
        </span>
      </div>
    </div>
  );
}
