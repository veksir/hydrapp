import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { getCurrentWeather } from "../weather";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { pushSupported, getPushSubscriptionStatus, subscribeToPush, unsubscribeFromPush, getPushUnavailableReason } from "../push";
import { MapPin, Sun, Moon, MonitorSmartphone } from "lucide-react";
import ContainerForm from "../components/ContainerForm";
import { ProfileSkeleton } from "../components/PageSkeletons";

const THEME_OPTIONS = [
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Oscuro", icon: Moon },
  { id: "system", label: "Sistema", icon: MonitorSmartphone },
];

const ACTIVITY_LEVEL_LABELS = {
  sedentario: "Sedentario",
  moderado: "Moderado",
  alto: "Alto / clima cálido",
};

export default function Profile() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [containers, setContainers] = useState([]);
  const [form, setForm] = useState(null);
  const [newContainer, setNewContainer] = useState({ name: "", volume_ml: "", container_type: "custom", drink_type: "agua" });
  const [editingContainerId, setEditingContainerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState("");

  async function handleDetectWeather() {
    setError("");
    setWeatherLoading(true);
    try {
      const w = await getCurrentWeather();
      update("climate_temp", w.tempC);
      update("climate_humidity", w.humidityPct);
    } catch (err) {
      setError(err.message);
    } finally {
      setWeatherLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([api.getProfile(), api.getContainers()])
      .then(([p, c]) => {
        setProfile(p);
        setForm(p);
        setContainers(c);
      })
      .catch((err) => {
        if (err.message.includes("Perfil no configurado")) {
          navigate("/configurar");
          return;
        }
        setError(err.message);
      })
      .finally(() => setLoading(false));

    if (pushSupported()) {
      getPushSubscriptionStatus().then(setPushOn).catch(() => {});
    }
  }, []);

  async function handleTogglePush() {
    setPushMessage("");
    setPushLoading(true);
    try {
      if (pushOn) {
        await unsubscribeFromPush();
        setPushOn(false);
        setPushMessage("Notificaciones desactivadas.");
      } else {
        await subscribeToPush();
        setPushOn(true);
        setPushMessage("¡Listo! Te avisaremos antes de que tengas sed.");
      }
    } catch (err) {
      setPushMessage(err.message);
    } finally {
      setPushLoading(false);
    }
  }

  async function handleTestPush() {
    setPushMessage("");
    try {
      const result = await api.pushTest();
      if (result?.sent === 0) {
        setPushMessage("No se pudo enviar: tu suscripción ya no está activa en el servidor. Desactívala y vuelve a activarla.");
      } else {
        setPushMessage("Notificación de prueba enviada — revisa tu dispositivo.");
      }
    } catch (err) {
      setPushMessage(err.message);
    }
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const updated = await api.saveProfile({
        ...form,
        weight_kg: Number(form.weight_kg),
        age_years: Number(form.age_years),
        default_activity_minutes: Number(form.default_activity_minutes),
        workout_time: form.workout_time || null,
        tz_offset_minutes: new Date().getTimezoneOffset(),
      });
      setProfile(updated);
      setForm(updated);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addContainer(e) {
    e.preventDefault();
    setError("");
    if (!newContainer.name || !newContainer.volume_ml) {
      setError("Ponle nombre y volumen a tu recipiente");
      return;
    }
    try {
      const payload = {
        name: newContainer.name,
        volume_ml: Number(newContainer.volume_ml),
        container_type: newContainer.container_type,
        drink_type: newContainer.drink_type,
      };
      if (editingContainerId) {
        const updated = await api.updateContainer(editingContainerId, payload);
        setContainers((cs) => cs.map((c) => (c.id === editingContainerId ? updated : c)));
        setEditingContainerId(null);
      } else {
        const created = await api.addContainer(payload);
        setContainers((c) => [...c, created]);
      }
      setNewContainer({ name: "", volume_ml: "", container_type: "custom", drink_type: "agua" });
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditContainer(c) {
    setError("");
    setEditingContainerId(c.id);
    setNewContainer({
      name: c.name,
      volume_ml: String(c.volume_ml),
      container_type: c.container_type || "custom",
      drink_type: c.drink_type || "agua",
    });
  }

  function cancelEditContainer() {
    setEditingContainerId(null);
    setError("");
    setNewContainer({ name: "", volume_ml: "", container_type: "custom", drink_type: "agua" });
  }

  async function removeContainer(id) {
    try {
      await api.deleteContainer(id);
      setContainers((c) => c.filter((x) => x.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  function handleLogout() {
    if (window.confirm("¿Cerrar sesión en este dispositivo?")) {
      logout();
      navigate("/login");
    }
  }

  if (loading) return <ProfileSkeleton />;
  if (!form) return null;

  return (
    <div className="setup-screen">
      <header className="setup-header">
        <h1>Tu perfil</h1>
        <p>{user?.name} · {user?.email}</p>
      </header>

      <form className="card setup-form" onSubmit={handleSave}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="p-weight">Peso (kg)</label>
            <input id="p-weight" type="number" min="1" required value={form.weight_kg} onChange={(e) => update("weight_kg", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="p-age">Edad (años)</label>
            <input id="p-age" type="number" min="1" max="120" required value={form.age_years} onChange={(e) => update("age_years", e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="p-sex">Sexo</label>
          <select
            id="p-sex"
            value={form.sex}
            onChange={(e) => {
              const sex = e.target.value;
              update("sex", sex);
              if (sex === "M") update("physio_state", "normal");
            }}
          >
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="p-physio">Estado fisiológico</label>
          <select id="p-physio" value={form.physio_state} disabled={form.sex === "M"} onChange={(e) => update("physio_state", e.target.value)}>
            <option value="normal">Normal</option>
            <option value="embarazo">Embarazo</option>
            <option value="lactancia">Lactancia</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="p-activity-level">Nivel de actividad general</label>
          <select id="p-activity-level" value={form.activity_level} onChange={(e) => update("activity_level", e.target.value)}>
            {Object.entries(ACTIVITY_LEVEL_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="p-wake">Te despiertas</label>
            <input id="p-wake" type="time" value={form.wake_time} onChange={(e) => update("wake_time", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="p-sleep">Te duermes</label>
            <input id="p-sleep" type="time" value={form.sleep_time} onChange={(e) => update("sleep_time", e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="p-default-activity">Minutos de ejercicio (día típico)</label>
          <input id="p-default-activity" type="number" min="0" value={form.default_activity_minutes} onChange={(e) => update("default_activity_minutes", e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="p-workout">¿A qué hora entrenas normalmente? (opcional)</label>
          <input id="p-workout" type="time" value={form.workout_time || ""} onChange={(e) => update("workout_time", e.target.value)} />
        </div>

        <div className="field">
          <button type="button" className="btn-ghost btn-with-icon" onClick={handleDetectWeather} disabled={weatherLoading}>
            <MapPin size={15} />
            {weatherLoading ? "Detectando..." : "Actualizar clima base con mi ubicación"}
          </button>
          <p className="setup-hint">
            Clima base actual: {Math.round(form.climate_temp)}°C · {Math.round(form.climate_humidity)}% humedad
          </p>
        </div>

        {error && <p className="error-text">{error}</p>}
        {saved && <p className="setup-hint">Guardado ✓</p>}
        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <div className="card setup-form">
        <h2 style={{ fontSize: 16 }}>Apariencia</h2>
        <div className="theme-toggle" role="group" aria-label="Tema de la app">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`theme-toggle__btn ${theme === opt.id ? "theme-toggle__btn--active" : ""}`}
              onClick={() => setTheme(opt.id)}
              aria-pressed={theme === opt.id}
            >
              <opt.icon size={16} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card setup-form">
        <h2 style={{ fontSize: 16 }}>Tus recipientes calibrados</h2>
        {containers.length > 0 ? (
          <ul className="container-list">
            {containers.map((c) => (
              <li key={c.id} className="container-list__item">
                <div className="container-list__meta">
                  <span className="container-list__name">
                    {c.name} · {c.volume_ml}ml
                    {c.container_type && c.container_type !== "custom" && (
                      <span className="container-list__tag">toma parcial</span>
                    )}
                  </span>
                </div>
                <div className="container-list__actions">
                  <button className="btn-ghost" onClick={() => startEditContainer(c)} type="button">
                    Editar
                  </button>
                  <button className="btn-ghost" onClick={() => removeContainer(c.id)} type="button">
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="setup-hint">Todavía no tienes recipientes calibrados.</p>
        )}

        <ContainerForm
          value={newContainer}
          onChange={(patch) => setNewContainer((c) => ({ ...c, ...patch }))}
          onSubmit={addContainer}
          submitLabel={editingContainerId ? "Guardar cambios" : "+ Agregar recipiente"}
          submitClass={editingContainerId ? "btn-primary" : "btn-ghost"}
          formStyle={{ padding: 0 }}
          fieldsInline
          editing={Boolean(editingContainerId)}
          onCancelEdit={cancelEditContainer}
          error={error}
        />
      </div>

      <div className="card setup-form">
        <h2 style={{ fontSize: 16 }}>Notificaciones antes de la sed</h2>
        <p className="setup-hint">
          Te avisamos con una notificación real del sistema, incluso con la app cerrada, cuando
          calculamos que probablemente vas a tener sed pronto.
        </p>
        {getPushUnavailableReason() ? (
          <p className="setup-hint">{getPushUnavailableReason()}</p>
        ) : (
          <>
            <button className="btn-primary" onClick={handleTogglePush} disabled={pushLoading} type="button">
              {pushLoading ? "Procesando..." : pushOn ? "Desactivar notificaciones" : "Activar notificaciones"}
            </button>
            {pushOn && (
              <button className="btn-ghost" onClick={handleTestPush} type="button">
                Enviarme una de prueba
              </button>
            )}
            {pushMessage && <p className="setup-hint">{pushMessage}</p>}
          </>
        )}
      </div>

      <button className="btn-ghost" style={{ color: "var(--danger)" }} onClick={handleLogout}>
        Cerrar sesión
      </button>
    </div>
  );
}
