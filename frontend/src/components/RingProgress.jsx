import { useEffect, useId, useRef, useState } from "react";
import "./RingProgress.css";

const SIZE = 200;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// El relleno de agua vive en un círculo más chico, adentro del track/arco
// (con un margen para que no se pisen visualmente).
const WATER_RADIUS = RADIUS - STROKE / 2 - 8;
const CENTER = SIZE / 2;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// Genera una ola como path SVG (curvas suaves repetidas), ancha de sobra
// (un tile extra de cada lado) para que el loop horizontal por CSS
// (translateX de 0 al ancho de un tile, ver RingProgress.css) no deje
// huecos. El nivel (level) es relativo a un origen fijo; después se
// traslada verticalmente entero según el % de la meta, en vez de
// recalcular el path en cada render — más barato y permite una
// transición CSS suave igual que ya tiene el arco de progreso.
function buildWavePath(amplitude, tile) {
  const width = SIZE + tile * 2;
  const startX = -tile;
  let d = `M ${startX} 0`;
  let x = startX;
  let up = true;
  while (x < startX + width) {
    const cx = x + tile / 2;
    const cy = up ? -amplitude : amplitude;
    const nx = x + tile;
    d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${nx.toFixed(1)} 0`;
    x = nx;
    up = !up;
  }
  d += ` L ${x.toFixed(1)} 400 L ${startX} 400 Z`;
  return d;
}

const WAVE_BACK = buildWavePath(5, 70);
const WAVE_FRONT = buildWavePath(6, 55);

// El progreso es el protagonista: cuando cambia el consumo, el número
// cuenta hacia arriba en vez de saltar directo al valor nuevo — eso es lo
// que hace que registrar un trago SE SIENTA como avanzar, no solo como un
// dato que cambió en la pantalla.
function useCountUp(target, duration = 650) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(target);
      prevRef.current = target;
      return;
    }
    const start = prevRef.current;
    const startTime = performance.now();
    let raf;

    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (target - start) * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

export default function RingProgress({ percent, consumedMl, goalMl, tone = "primary", onCelebrate }) {
  const clipId = useId();
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  const displayMl = useCountUp(Math.round(consumedMl));

  const wasComplete = useRef(percent >= 100);
  const [celebrate, setCelebrate] = useState(false);

  // Solo celebra la primera vez que se cruza el 100% (no en cada registro
  // adicional mientras se sigue por encima de la meta): wasComplete.current
  // se marca en true de una vez al disparar, no solo cuando NO celebra —
  // si no, como el efecto se re-ejecuta con cada cambio de percent, un
  // segundo trago después de cumplir la meta volvía a disparar el pulso.
  useEffect(() => {
    const isComplete = percent >= 100;
    if (isComplete && !wasComplete.current && !prefersReducedMotion()) {
      setCelebrate(true);
      wasComplete.current = true;
      onCelebrate?.();
      const t = setTimeout(() => setCelebrate(false), 900);
      return () => clearTimeout(t);
    }
    wasComplete.current = isComplete;
  }, [percent, onCelebrate]);

  // Nivel del agua: 0% de la meta = fondo del círculo interno, 100% =
  // tope. Se traslada el grupo entero de olas (ver buildWavePath) en vez
  // de recalcular el path — permite una transición CSS suave del ascenso,
  // igual que ya hace el arco con stroke-dashoffset.
  const waterLevel = CENTER + WATER_RADIUS - (clamped / 100) * (WATER_RADIUS * 2);

  return (
    <div className={`ring-progress ${celebrate ? "ring-progress--celebrate" : ""}`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          <clipPath id={`ring-progress-water-clip-${clipId}`}>
            <circle cx={CENTER} cy={CENTER} r={WATER_RADIUS} />
          </clipPath>
        </defs>

        {/* relleno de agua: solo visible dentro del círculo interno vía
            clip-path. La base es el tint del tono (mismo verde/azul/rojo
            que usa el resto de la UI para success/primary/danger) para
            que combine con claro/oscuro sin variables nuevas. */}
        <g clipPath={`url(#ring-progress-water-clip-${clipId})`}>
          <rect
            x={CENTER - WATER_RADIUS}
            y={CENTER - WATER_RADIUS}
            width={WATER_RADIUS * 2}
            height={WATER_RADIUS * 2}
            fill={`var(--${tone}-tint)`}
          />
          <g
            className="ring-progress__wave ring-progress__wave--back"
            style={{ transform: `translateY(${waterLevel + 3}px)` }}
          >
            <path d={WAVE_BACK} fill={`var(--${tone})`} opacity={0.35} />
          </g>
          <g
            className="ring-progress__wave ring-progress__wave--front"
            style={{ transform: `translateY(${waterLevel}px)` }}
          >
            <path d={WAVE_FRONT} fill={`var(--${tone})`} opacity={0.7} />
          </g>
        </g>

        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--surface-sunk)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={`var(--${tone})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className="ring-progress__arc"
        />
      </svg>
      <div className="ring-progress__center">
        <span className="ring-progress__amount">{displayMl}</span>
        <span className="ring-progress__unit">de {Math.round(goalMl)} ml</span>
      </div>
    </div>
  );
}
