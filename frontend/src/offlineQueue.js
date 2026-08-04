const QUEUE_KEY = "hydrapp_offline_queue";

function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function queueLength() {
  return readQueue().length;
}

export function addToOfflineQueue(payload) {
  const queue = readQueue();
  queue.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, payload, queuedAt: Date.now() });
  writeQueue(queue);
}

// Intenta enviar cada registro pendiente. Si uno falla (sigue sin señal),
// se detiene ahí y deja el resto en la cola para el próximo intento — no
// tiene sentido seguir insistiendo si el problema es la conexión.
export async function syncOfflineQueue(logWaterFn) {
  const queue = readQueue();
  if (!queue.length) return { syncedCount: 0, remaining: 0 };

  let syncedCount = 0;
  const remaining = [...queue];

  while (remaining.length) {
    const entry = remaining[0];
    try {
      await logWaterFn(entry.payload);
      remaining.shift();
      syncedCount += 1;
    } catch {
      break; // probablemente sigue sin señal, no seguir insistiendo ahora
    }
  }

  writeQueue(remaining);
  return { syncedCount, remaining: remaining.length };
}

export function isNetworkError(err) {
  return err?.message?.includes("No se pudo conectar con el servidor");
}
