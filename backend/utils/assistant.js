const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const assistantEnabled = Boolean(GROQ_API_KEY);

if (!assistantEnabled) {
  console.warn(
    "[WARN] GROQ_API_KEY no configurado — el asistente de hidratación está desactivado. " +
      "Crea una key gratis en https://console.groq.com y ponla en tu .env."
  );
}

const SYSTEM_PROMPT = `Eres el asistente de hidratación de HydrApp, una app de seguimiento de agua con base científica.

Reglas:
- Responde SOLO temas de hidratación, agua, bebidas, electrolitos, ejercicio y sudoración, clima y su efecto en la sed, y cómo usar la app.
- Si preguntan algo fuera de eso, redirige amablemente al tema de hidratación.
- No eres médico. No diagnostiques. Si preguntan por síntomas de deshidratación o sobrehidratación, sugiere usar el chequeo de síntomas de la app y, si sus síntomas son severos (confusión, letargo, náuseas intensas), recomienda atención médica.
- Sé breve y concreto — 2 a 4 oraciones normalmente, salvo que pidan detalle.
- Usa la información de contexto del usuario (si viene) para personalizar la respuesta, sin inventar datos que no te dieron.
- No repitas literalmente el contexto del usuario ni digas "según tu contexto" — intégralo con naturalidad.
- Si el usuario está atrasado en su meta, recomiéndale emparejarse de a poco, en sorbos distribuidos a lo largo del día, nunca de una sola toma grande: el cuerpo absorbe mejor el agua repartida.
- Responde siempre en español.`;

async function callAssistant({ messages, userContext }) {
  if (!assistantEnabled) {
    const err = new Error("El asistente no está configurado en este servidor todavía");
    err.status = 400;
    throw err;
  }

  const systemMessage = userContext
    ? `${SYSTEM_PROMPT}\n\nContexto del usuario ahora mismo: ${userContext}`
    : SYSTEM_PROMPT;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "system", content: systemMessage }, ...messages],
      temperature: 0.4,
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[assistant] Groq error:", res.status, body);
    const err = new Error("El asistente no pudo responder en este momento");
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) {
    const err = new Error("El asistente no pudo responder en este momento");
    err.status = 502;
    throw err;
  }
  return reply;
}

module.exports = { callAssistant, assistantEnabled };
