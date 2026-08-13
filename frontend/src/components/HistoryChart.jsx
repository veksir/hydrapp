import { useMemo, useRef, useState } from "react";
import "./HistoryChart.css";

const WIDTH = 320;
const HEIGHT = 140;
const PAD_X = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;

// Gráfica de línea simple en SVG puro (sin librerías) que muestra el % de
// meta cumplida por día. Solo se dibujan los días CON registro; los días
// "sin dato" se marcan aparte y no interpolan la línea sobre ellos.
// Interacción: pointer events resuelven el día por la coordenada X (no por
// un punto de ~5px), con guía vertical y scrub — un dedo de ~48px mapea
// siempre al día más cercano y deslizando se recorre el detalle día a día.
export default function HistoryChart({ rows }) {
  const svgRef = useRef(null);
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

  function resolveHover(e) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      if (points[i].y === null) continue;
      const d = Math.abs(points[i].x - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    if (best !== -1) setHover(best);
  }

  return (
    <div className="history-chart card">
      <p className="history-chart__title">Tendencia (% de meta por día)</p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="history-chart__svg"
        onPointerDown={(e) => {
          if (e.pointerType === "touch") e.currentTarget.setPointerCapture(e.pointerId);
          resolveHover(e);
        }}
        onPointerMove={resolveHover}
        onPointerLeave={(e) => {
          // En touch, soltar el dedo dispara pointerleave (el puntero deja de
          // existir); no hay que limpiar el hover o la selección se borra sola.
          if (e.pointerType !== "touch") setHover(null);
        }}
      >
        {activePoint && (
          <line
            x1={activePoint.x}
            y1={PAD_TOP}
            x2={activePoint.x}
            y2={HEIGHT - PAD_BOTTOM}
            className="history-chart__guide"
          />
        )}
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
              r={hover === i ? 6 : 2.5}
              className={`history-chart__dot ${p.pct >= 100 ? "history-chart__dot--good" : ""}`}
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
        <p className="history-chart__tooltip history-chart__tooltip--hint">Toca o desliza sobre la gráfica para ver el detalle</p>
      )}
    </div>
  );
}
