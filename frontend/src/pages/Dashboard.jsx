import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { fetchLiveWeather } from "../weather";
import RingProgress from "../components/RingProgress";
import StatusCards from "../components/StatusCards";
import TodayLogs from "../components/TodayLogs";
import EducationCapsule from "../components/EducationCapsule";
import LogDrinkSheet from "../components/LogDrinkSheet";
import ActivitySheet from "../components/ActivitySheet";
import CenterAlert from "../components/CenterAlert";
import { MapPin, Wifi } from "lucide-react";
import { addToOfflineQueue, syncOfflineQueue, isNetworkError, queueLength } from "../offlineQueue";

function greeting(name) {
  const hour = new Date().getHours();
  const salute = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  return name ? `${salute}, ${name.split(" ")[0]}` : salute;
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [drinkTypes, setDrinkTypes] = useState([]);
  const [containers, setContainers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [logFeedback, setLogFeedback] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(Boolean(location.state?.openLog));
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    if (location.state?.openLog) {
      setSheetOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  async function load() {
    try {
      const [today, types, containerList] = await Promise.all([
        api.getToday(),
        api.getDrinkTypes(),
        api.getContainers(),
      ]);
      setData(today);
      setDrinkTypes(types);
      setContainers(containerList);
    } catch (err) {
      if (err.message.includes("Perfil no configurado")) {
        navigate("/configurar");
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // H3: la predicción de sed depende del tiempo transcurrido, así que el
  // dashboard no puede quedarse con datos congelados. Se refresca al volver
  // a la pestaña y cada 60s mientras está visible (nada agresivo, pero
  // suficiente para que el mensaje central de la app no quede viejo).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearInterval(interval);
    };
  }, []);

  // M8: si había registros guardados localmente por falta de señal, se
  // intentan enviar al cargar y cada vez que vuelve la conexión.
  useEffect(() => {
    trySync();
    function onOnline() {
      trySync();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  async function trySync() {
    setPendingSync(queueLength());
    const { syncedCount, remaining } = await syncOfflineQueue((payload) => api.logWater(payload));
    setPendingSync(remaining);
    if (syncedCount > 0) await load();
  }

  async function handleLog({ drink_type, amount_ml, container_id }) {
    setError("");
    setSubmitting(true);
    try {
      const res = await api.logWater({ drink_type, amount_ml, container_id });
      setHighlightId(res.log.id);
      if (navigator.vibrate) navigator.vibrate(30);
      setLogFeedback(
        res.feedback?.message
          ? res.feedback
          : { level: "success", message: `+${res.log.amount_ml}ml registrados` }
      );
      await load();
    } catch (err) {
      if (isNetworkError(err)) {
        addToOfflineQueue({ drink_type, amount_ml, container_id });
        setPendingSync(queueLength());
        setLogFeedback({
          level: "info",
          message: "Sin conexión ahora mismo. Guardé tu registro y lo voy a enviar en cuanto vuelva la señal.",
        });
      } else {
        setLogFeedback({ level: "danger", message: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLiveWeather() {
    setWeatherError("");
    setWeatherLoading(true);
    try {
      await fetchLiveWeather();
      await load();
    } catch (err) {
      setWeatherError(err.message);
    } finally {
      setWeatherLoading(false);
    }
  }

  async function handleActivity(minutes) {
    setSubmitting(true);
    try {
      await api.setTodayContext({ activity_minutes: minutes });
      await load();
    } catch (err) {
      setLogFeedback({ level: "danger", message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteLog(id) {
    try {
      await api.deleteLog(id);
      await load();
    } catch (err) {
      setLogFeedback({ level: "danger", message: err.message });
      // Re-lanzar para que TodayLogs sepa que el borrado falló y pueda
      // liberar su guard (si no, el registro queda trabado y no se
      // puede reintentar borrar sin refrescar la página).
      throw err;
    }
  }

  if (loading) return <div className="screen-center">Cargando tu progreso...</div>;
  if (error) return <div className="screen-center error-text">{error}</div>;
  if (!data) return null;

  const percent = (data.consumed_ml / data.goal.total_ml) * 100;
  const ringTone = percent >= 100 ? "success" : percent < 40 && data.hydration.status === "muy_atrasado" ? "danger" : "primary";

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">{new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1>{greeting(user?.name)}</h1>
        </div>
      </header>

      {pendingSync > 0 && (
        <div className="pending-sync-banner">
          <Wifi size={14} style={{ flexShrink: 0 }} />
          <span>
            {pendingSync} registro{pendingSync > 1 ? "s" : ""} guardado{pendingSync > 1 ? "s" : ""} sin conexión, se
            enviará{pendingSync > 1 ? "n" : ""} cuando vuelva la señal.
          </span>
        </div>
      )}

      <section className="card dashboard__goal-explainer">
        <p>
          Hoy necesitas aproximadamente <strong>{(data.goal.total_ml / 1000).toFixed(1)} L</strong> según
        </p>
        <div className="dashboard__goal-checks">
          <span>✔ peso</span>
          <span>✔ temperatura</span>
          <span>✔ actividad</span>
          <span>✔ humedad</span>
        </div>
      </section>

      <section className="card dashboard__hero">
        <button
          className="dashboard__ring-button"
          onClick={() => setSheetOpen(true)}
          aria-label="Registrar bebida"
        >
          <RingProgress percent={percent} consumedMl={data.consumed_ml} goalMl={data.goal.total_ml} tone={ringTone} />
        </button>
        <p className="dashboard__message">{data.hydration.message}</p>
        {data.consumed_ml === 0 && (
          <p className="dashboard__first-hint">Toca el anillo o el botón + de abajo para registrar tu primer trago</p>
        )}
      </section>

      <TodayLogs logs={data.logs} onDelete={handleDeleteLog} highlightId={highlightId} />

      <StatusCards
        hydrationStatus={data.hydration.status}
        tempC={data.inputs_used.temp_c}
        climateBonusMl={data.goal.breakdown.climate_ml + data.goal.breakdown.humidity_bonus_ml}
        activityMinutes={data.inputs_used.activity_minutes}
        activityIsLive={data.inputs_used.activity_is_live}
        onActivityClick={() => setActivitySheetOpen(true)}
      />

      <section className="card dashboard__weather">
        <div>
          <p className="dashboard__weather-label">
            {data.inputs_used.weather_is_live ? "Clima real de hoy" : "Usando clima de tu perfil"}
          </p>
          <p className="dashboard__weather-value">
            {Math.round(data.inputs_used.temp_c)}°C · {Math.round(data.inputs_used.humidity_pct)}% humedad
          </p>
        </div>
        <button className="btn-ghost" onClick={handleLiveWeather} disabled={weatherLoading}>
          {weatherLoading ? "Ubicando..." : "Usar mi ubicación"}
        </button>
      </section>
      {weatherError && <p className="error-text">{weatherError}</p>}

      <EducationCapsule />

      <button className="symptom-cta" onClick={() => navigate("/sintomas")}>
        <span>¿Cómo te sientes? Revisa tus síntomas</span>
        <span aria-hidden="true">→</span>
      </button>

      <button className="symptom-cta symptom-cta--assistant" onClick={() => navigate("/asistente")}>
        <span>¿Dudas de hidratación? Pregúntale al asistente</span>
        <span aria-hidden="true">→</span>
      </button>

      <CenterAlert feedback={logFeedback} onClose={() => setLogFeedback(null)} />

      <LogDrinkSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        drinkTypes={drinkTypes}
        containers={containers}
        onSubmit={handleLog}
        submitting={submitting}
      />

      <ActivitySheet
        open={activitySheetOpen}
        onClose={() => setActivitySheetOpen(false)}
        currentMinutes={data.inputs_used.activity_minutes}
        onSubmit={handleActivity}
        submitting={submitting}
      />
    </div>
  );
}
