import { api } from "./api";

/**
 * Pide ubicación al navegador y consulta Open-Meteo (gratis, sin API key)
 * para traer temperatura y humedad reales. No decide qué hacer con el
 * dato — eso lo hace quien llama (guardarlo como contexto de hoy, o como
 * clima base del perfil durante el onboarding).
 */
export function getCurrentWeather() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Tu navegador no soporta geolocalización"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("No se pudo consultar el clima");
          const data = await res.json();
          if (
            typeof data?.current?.temperature_2m !== "number" ||
            typeof data?.current?.relative_humidity_2m !== "number"
          ) {
            throw new Error("No se pudo consultar el clima");
          }
          resolve({ tempC: data.current.temperature_2m, humidityPct: data.current.relative_humidity_2m });
        } catch (err) {
          reject(err);
        }
      },
      () => reject(new Error("No pudimos acceder a tu ubicación. Revisa los permisos del navegador.")),
      { timeout: 10000 }
    );
  });
}

/**
 * Consulta el clima real y lo guarda como override de HOY (botón del
 * dashboard) — no toca el clima base del perfil.
 */
export async function fetchLiveWeather() {
  const { tempC, humidityPct } = await getCurrentWeather();
  await api.setTodayContext({ temp_override: tempC, humidity_override: humidityPct });
  return { tempC, humidityPct };
}
