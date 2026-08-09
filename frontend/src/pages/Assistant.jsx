import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const SUGGESTIONS = [
  "¿Cuánta agua debería tomar hoy?",
  "¿El café deshidrata?",
  "¿Qué es la hiponatremia?",
  "¿Cómo sé si estoy deshidratado?",
];

export default function Assistant() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    api.getAssistantStatus().then((s) => setEnabled(s.enabled)).catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function sendMessage(text) {
    const content = text.trim();
    if (!content || sending) return;

    setError("");
    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await api.assistantChat(nextMessages);
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (err) {
      setError(err.message);
      setMessages(nextMessages); // deja el mensaje del usuario, sin respuesta falsa
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  if (enabled === null) return <div className="screen-center">Cargando...</div>;

  if (enabled === false) {
    return (
      <div className="screen-center" style={{ flexDirection: "column", gap: 12 }}>
        <p style={{ fontWeight: 600 }}>El asistente no está disponible todavía</p>
        <p style={{ maxWidth: "30ch" }}>
          Este servidor no tiene configurado el asistente conversacional. Mientras tanto, puedes
          revisar el chequeo de síntomas o la cápsula educativa del día.
        </p>
        <button className="btn-primary" onClick={() => navigate("/")}>
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="assistant-screen">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Asistente</p>
          <h1>Dudas de hidratación</h1>
        </div>
      </header>

      <div className="assistant-chat">
        {messages.length === 0 && (
          <div className="assistant-empty">
            <p className="setup-hint">Pregúntame lo que quieras sobre hidratación, agua, electrolitos o clima.</p>
            <div className="assistant-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="assistant-suggestion" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`assistant-bubble assistant-bubble--${m.role}`}>
            <p>{m.content}</p>
          </div>
        ))}

        {sending && (
          <div className="assistant-bubble assistant-bubble--assistant assistant-bubble--typing">
            <span />
            <span />
            <span />
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form className="assistant-input" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Escribe tu pregunta..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button className="btn-primary" type="submit" disabled={sending || !input.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
