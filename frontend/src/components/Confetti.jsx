// Ráfaga de confeti al cumplir la meta del día, disparada una sola vez
// por RingProgress.onCelebrate (ver RingProgress.jsx). Deliberadamente
// simple: unos divs con CSS keyframes, sin librería externa ni canvas —
// se desmonta solo después de la animación. No hace falta chequear
// prefers-reduced-motion acá: RingProgress ya no llama a onCelebrate
// bajo esa condición, así que este componente nunca llega a montarse.
import { useEffect, useState } from "react";
import "./Confetti.css";

const COLORS = ["--primary", "--secondary", "--success", "--warning"];
const PIECE_COUNT = 24;

// Generado una sola vez por ráfaga (no en cada render) para que las
// piezas no "salten" de posición mientras dura la animación.
function buildPieces() {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.25,
    duration: 1.1 + Math.random() * 0.6,
    rotation: Math.round(Math.random() * 360),
    color: COLORS[i % COLORS.length],
    drift: Math.round((Math.random() - 0.5) * 120),
  }));
}

export default function Confetti({ onDone }) {
  const [pieces] = useState(buildPieces);

  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 1700);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti__piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            "--confetti-rotate": `${p.rotation}deg`,
            "--confetti-drift": `${p.drift}px`,
            background: `var(${p.color})`,
          }}
        />
      ))}
    </div>
  );
}
