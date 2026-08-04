const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getToken() {
  return localStorage.getItem("hydrapp_token");
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu conexión.");
  }

  if (res.status === 401 && auth) {
    localStorage.removeItem("hydrapp_token");
    localStorage.removeItem("hydrapp_user");
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new Error("Tu sesión expiró. Inicia sesión de nuevo.");
  }

  if (res.status === 204) return null;

  let data = {};
  try {
    data = await res.json();
  } catch {
    // respuesta sin cuerpo JSON (ej. error de red o de proxy)
  }

  if (!res.ok) {
    throw new Error(data.error || "Ocurrió un error inesperado");
  }
  return data;
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload, auth: false }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload, auth: false }),

  getProfile: () => request("/profile"),
  saveProfile: (payload) => request("/profile", { method: "PUT", body: payload }),

  getContainers: () => request("/containers"),
  addContainer: (payload) => request("/containers", { method: "POST", body: payload }),
  deleteContainer: (id) => request(`/containers/${id}`, { method: "DELETE" }),

  getToday: () => request("/logs/today"),
  logWater: (payload) => request("/logs", { method: "POST", body: payload }),
  deleteLog: (id) => request(`/logs/${id}`, { method: "DELETE" }),
  setTodayContext: (payload) => request("/logs/context/today", { method: "PUT", body: payload }),
  getHistory: (days = 14) => request(`/logs/history?days=${days}`),
  getDrinkTypes: () => request("/logs/drink-types"),
  getInsights: () => request("/insights"),

  getSymptomCatalog: () => request("/symptoms/catalog"),
  checkSymptoms: (symptom_ids) => request("/symptoms/check", { method: "POST", body: { symptom_ids } }),

  getPushPublicKey: () => request("/push/vapid-public-key"),
  pushSubscribe: (subscription) => request("/push/subscribe", { method: "POST", body: subscription }),
  pushUnsubscribe: (payload) => request("/push/unsubscribe", { method: "POST", body: payload }),
  pushTest: () => request("/push/test", { method: "POST" }),
};

export { getToken };
