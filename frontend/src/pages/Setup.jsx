import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { getCurrentWeather } from "../weather";
import { MapPin } from "lucide-react";
import ContainerForm from "../components/ContainerForm";

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detectedWeather, setDetectedWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  const [profile, setProfile] = useState({
    weight_kg: "",
    age_years: "",
    sex: "F",
    physio_state: "normal",
    wake_time: "07:00",
    sleep_time: "23:00",
    activity_level: "moderado",
    default_activity_minutes: 20,
    workout_time: "",
  });

  const [containers, setContainers] = useState([]);
  const [newContainer, setNewContainer] = useState({ name: "", volume_ml: "", container_type: "custom", drink_type: "agua", refObject: "manual", heightCm: "" });

  useEffect(() => {
    api.getContainers().then(setContainers).catch(() => {});
  }, []);

  function updateProfile(field, value) {
    setProfile((p) => ({ ...p, [field]: value }));
  }

  async function handleDetectWeather() {
    setWeatherError("");
    setWeatherLoading(true);
    try {
      const w = await getCurrentWeather();
      setDetectedWeather(w);
    } catch (err) {
      setWeatherError(err.message);
    } finally {
      setWeatherLoading(false);
    }
  }

  async function saveProfileStep(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.saveProfile({
        ...profile,
        weight_kg: Number(profile.weight_kg),
        age_years: Number(profile.age_years),
        default_activity_minutes: Number(profile.default_activity_minutes),
        workout_time: profile.workout_time || null,
        tz_offset_minutes: new Date().getTimezoneOffset(),
        ...(detectedWeather
          ? { climate_temp: detectedWeather.tempC, climate_humidity: detectedWeather.humidityPct }
          : {}),
      });
      setStep(2);
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
      const created = await api.addContainer({
        name: newContainer.name,
        volume_ml: Number(newContainer.volume_ml),
        container_type: newContainer.container_type,
        drink_type: newContainer.drink_type,
      });
      setContainers((c) => [...c, created]);
      setNewContainer({ name: "", volume_ml: "", container_type: "custom", drink_type: "agua", refObject: "manual", heightCm: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  function estimateVolume() {
    // Calibración simple por comparación visual: el usuario mide la altura
    // de agua útil de su vaso comparándola con un objeto de referencia
    // conocido, y estima el volumen como un cilindro aproximado usando un
    // diámetro típico de vaso (7cm) si no lo especifica. Es un puente
    // razonable hacia la visión por cámara real que vendrá en v2.
    const h = Number(newContainer.heightCm);
    if (!h) return;
    const diameterCm = 7;
    const radiusCm = diameterCm / 2;
    const volumeMl = Math.round(Math.PI * radiusCm * radiusCm * h);
    setNewContainer((c) => ({ ...c, volume_ml: volumeMl }));
  }

  return (
    <div className="setup-screen">
      <header className="setup-header">
        <h1>{step === 1 ? "Cuéntanos de ti" : "Calibra tus recipientes"}</h1>
        <p>{step === 1 ? "Con esto calculamos tu meta diaria." : "Así medimos lo que realmente tomas."}</p>
      </header>

      {step === 1 && (
        <form className="card setup-form" onSubmit={saveProfileStep}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="weight">Peso (kg)</label>
              <input id="weight" type="number" min="1" required value={profile.weight_kg} onChange={(e) => updateProfile("weight_kg", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="age">Edad (años)</label>
              <input id="age" type="number" min="1" max="120" required value={profile.age_years} onChange={(e) => updateProfile("age_years", e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="sex">Sexo</label>
            <select
              id="sex"
              value={profile.sex}
              onChange={(e) => {
                const sex = e.target.value;
                updateProfile("sex", sex);
                if (sex === "M") updateProfile("physio_state", "normal");
              }}
            >
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
            </select>
            <p className="setup-hint">Se usa junto con tu edad para calcular tu meta base según las guías científicas (IOM).</p>
          </div>

          <div className="field">
            <label htmlFor="physio">Estado fisiológico</label>
            <select
              id="physio"
              value={profile.physio_state}
              disabled={profile.sex === "M"}
              onChange={(e) => updateProfile("physio_state", e.target.value)}
            >
              <option value="normal">Normal</option>
              <option value="embarazo">Embarazo</option>
              <option value="lactancia">Lactancia</option>
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="wake">Te despiertas</label>
              <input id="wake" type="time" value={profile.wake_time} onChange={(e) => updateProfile("wake_time", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="sleep">Te duermes</label>
              <input id="sleep" type="time" value={profile.sleep_time} onChange={(e) => updateProfile("sleep_time", e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="activity_level">Nivel de actividad general</label>
            <select id="activity_level" value={profile.activity_level} onChange={(e) => updateProfile("activity_level", e.target.value)}>
              <option value="sedentario">Sedentario (poco o nada de ejercicio)</option>
              <option value="moderado">Moderado</option>
              <option value="alto">Alto / clima cálido habitual</option>
            </select>
            <p className="setup-hint">Cambia cuánta agua por kilo usamos como tu base diaria.</p>
          </div>

          <div className="field">
            <label htmlFor="activity">Minutos de ejercicio (día típico)</label>
            <input id="activity" type="number" min="0" value={profile.default_activity_minutes} onChange={(e) => updateProfile("default_activity_minutes", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="workout_time">¿A qué hora entrenas normalmente? (opcional)</label>
            <input id="workout_time" type="time" value={profile.workout_time} onChange={(e) => updateProfile("workout_time", e.target.value)} />
            <p className="setup-hint">Si la das, reforzamos los avisos de agua antes y después de esa hora.</p>
          </div>

          <div className="field">
            <button type="button" className="btn-ghost btn-with-icon" onClick={handleDetectWeather} disabled={weatherLoading}>
              <MapPin size={15} />
              {weatherLoading ? "Detectando tu clima..." : detectedWeather ? "Clima detectado con tu ubicación ✓" : "Usar mi ubicación para tu clima"}
            </button>
            {detectedWeather && (
              <p className="setup-hint">
                {Math.round(detectedWeather.tempC)}°C · {Math.round(detectedWeather.humidityPct)}% humedad — así
                calculamos tu meta base. Puedes ajustarlo cualquier día desde el dashboard.
              </p>
            )}
            {weatherError && <p className="error-text">{weatherError}</p>}
            {!detectedWeather && !weatherError && (
              <p className="setup-hint">
                Si no lo detectas ahora, empezamos con un clima templado por defecto (25°C) hasta que uses
                el botón de ubicación en el dashboard.
              </p>
            )}
          </div>

          {error && <p className="error-text">{error}</p>}
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Continuar"}
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="setup-containers">
          <div className="card setup-form">
            <p className="setup-hint">
              Opcional: si mides tu recipiente una vez, quedará calibrado para siempre.
              Si prefieres, puedes empezar ya con las cantidades rápidas (250/500/750ml...) y calibrar
              recipientes después desde tu perfil.
            </p>

            <ContainerForm
              value={newContainer}
              onChange={(patch) => setNewContainer((c) => ({ ...c, ...patch }))}
              onSubmit={addContainer}
              submitLabel="Guardar recipiente"
              error={error}
            >
              <div className="field">
                <label htmlFor="cheight">Altura del agua (cm) — opcional, para estimar</label>
                <div className="field-with-button">
                  <input
                    id="cheight"
                    type="number"
                    min="0"
                    value={newContainer.heightCm}
                    onChange={(e) => setNewContainer((c) => ({ ...c, heightCm: e.target.value }))}
                  />
                  <button type="button" className="btn-ghost" onClick={estimateVolume}>
                    Estimar
                  </button>
                </div>
              </div>
            </ContainerForm>
          </div>

          {containers.length > 0 && (
            <ul className="container-list">
              {containers.map((c) => (
                <li key={c.id} className="container-list__item">
                  <span>{c.name}</span>
                  <span className="container-list__vol">{c.volume_ml} ml</span>
                </li>
              ))}
            </ul>
          )}

          <button className="btn-primary" onClick={() => navigate("/")}>
            {containers.length === 0 ? "Empezar sin calibrar (puedo hacerlo después)" : "Empezar a registrar"}
          </button>
        </div>
      )}
    </div>
  );
}
