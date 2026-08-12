import { useMemo, useState } from "react";
import "./HistoryChart.css";

const WIDTH = 320;
const HEIGHT = 140;
const PAD_X = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;

// Gráfica de línea simple en SVG puro (sin librerías) que muestra el % de
// meta cumplida por día. Solo se dibujan los días CON registro; los días
// "sin dato" se marcan aparte y no interpolan la línea sobre ellos.
export default function HistoryChart({ rows }) {
  const [hover, setHover] = useState(null);

  const { points, goalY } = useMemo(() => {
    if (rows.length < 2) return { points: [], goalY: 0 };
    const innerW = WIDTH - PAD_X * 2;
    const step = innerW / (rows.length - 1);
    const maxPct = Math.max(100, ...rows.map((r) => r.pct));
    const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

    const pts = rows.map((r, i) => {
      const x = PAD_X + step * i;
      const y = r.entries === 0 ? null : PAD_TOP + innerH - (Math.min(r.pct, maxPct) / maxPct) * innerH;
      return { ...r, x, y };
    });
    const gY = PAD_TOP + innerH - (100 / maxPct) * innerH;
    return { points: pts, goalY: gY };
  }, [rows]);

  if (points.length < 2) return null;

  // Construye el path solo entre puntos consecutivos que SÍ tienen dato,
  // para no dibujar una línea falsa cruzando los días sin registro.
  const segments = [];
  let current = [];
  for (const p of points) {
    if (p.y === null) {
      if (current.length > 1) segments.push(current);
      current = [];
    } else {
      current.push(p);
    }
  }
  if (current.length > 1) segments.push(current);

  const activePoint = hover !== null ? points[hover] : null;

  return (
    <div className="history-chart card">
      <p className="history-chart__title">Tendencia (% de meta por día)</p>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="history-chart__svg"
        onMouseLeave={() => setHover(null)}
      >
        <line x1={PAD_X} y1={goalY} x2={WIDTH - PAD_X} y2={goalY} className="history-chart__goal-line" />

        {segments.map((seg, si) => (
          <polyline
            key={si}
            className="history-chart__line"
            points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
          />
        ))}

        {points.map((p, i) =>
          p.y !== null ? (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hover === i ? 4.5 : 2.5}
              className={`history-chart__dot ${p.pct >= 100 ? "history-chart__dot--good" : ""}`}
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          ) : (
            <circle key={i} cx={p.x} cy={HEIGHT - PAD_BOTTOM + 8} r={2} className="history-chart__dot--empty" />
          )
        )}
      </svg>

      {activePoint ? (
        <p className="history-chart__tooltip">
          {new Date(activePoint.date + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
          {" · "}
          <strong>{activePoint.pct}%</strong> ({activePoint.consumed_ml} ml)
        </p>
      ) : (
        <p className="history-chart__tooltip history-chart__tooltip--hint">Toca un punto para ver el detalle</p>
      )}
    </div>
  );
}
