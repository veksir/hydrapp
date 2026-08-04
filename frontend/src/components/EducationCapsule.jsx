import { useState } from "react";
import { EDUCATIONAL_FACTS, factOfTheDay } from "../educationalFacts";
import "./EducationCapsule.css";

export default function EducationCapsule() {
  const startIndex = EDUCATIONAL_FACTS.indexOf(factOfTheDay());
  const [index, setIndex] = useState(startIndex === -1 ? 0 : startIndex);

  function next() {
    setIndex((i) => (i + 1) % EDUCATIONAL_FACTS.length);
  }
  function prev() {
    setIndex((i) => (i - 1 + EDUCATIONAL_FACTS.length) % EDUCATIONAL_FACTS.length);
  }

  return (
    <div className="education-capsule">
      <div className="education-capsule__header">
        <span>¿Sabías que?</span>
        <div className="education-capsule__nav">
          <button onClick={prev} aria-label="Anterior">‹</button>
          <button onClick={next} aria-label="Siguiente">›</button>
        </div>
      </div>
      <p>{EDUCATIONAL_FACTS[index]}</p>
    </div>
  );
}
