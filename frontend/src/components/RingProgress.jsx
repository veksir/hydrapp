import { useEffect, useRef, useState } from "react";
import "./RingProgress.css";

const SIZE = 200;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

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

  return (
    <div className={`ring-progress ${celebrate ? "ring-progress--celebrate" : ""}`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
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
