// Formulario de recipiente compartido entre Setup y Perfil. Cualquier
// recipiente puede marcarse como termo/jarra/botellón (container_type) —
// sin umbral de volumen — para que la app lo trate con tomas parciales y
// nivel de líquido en vez de un registro de golpe. El drink_type define el
// contenido habitual del tarro (agua, café, jugo...) y se usa al registrar
// cada toma parcial.
import { DrinkIcon, DRINK_TYPES } from "../drinkIcons";

const TYPE_OPTIONS = [
  { id: "custom", label: "Otro (vaso normal)" },
  { id: "thermos", label: "Termo térmico" },
  { id: "pitcher", label: "Jarra" },
  { id: "dispenser", label: "Botellón / garrafa" },
];

export default function ContainerForm({
  value,
  onChange,
  onSubmit,
  submitLabel = "Guardar recipiente",
  submitClass = "btn-primary",
  formClass = "setup-form",
  formStyle,
  error,
  fieldsInline = false,
  editing = false,
  onCancelEdit,
  children,
}) {
  const set = (patch) => onChange({ ...value, ...patch });
  const isTrackingType = value.container_type && value.container_type !== "custom";
  const content = DRINK_TYPES.find((d) => d.id === value.drink_type) || DRINK_TYPES[0];

  const nameInput = (
    <div className="field">
      <label htmlFor="cf-name">Nombre del recipiente</label>
      <input
        id="cf-name"
        placeholder="Ej: Mi termo"
        value={value.name}
        onChange={(e) => set({ name: e.target.value })}
      />
    </div>
  );

  const volumeInput = (
    <div className="field">
      <label htmlFor="cf-vol">Volumen (ml)</label>
      <input
        id="cf-vol"
        type="number"
        min="1"
        required
        value={value.volume_ml}
        onChange={(e) => set({ volume_ml: e.target.value })}
      />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className={formClass} style={formStyle}>
      {fieldsInline ? (
        <div className="field-row">
          {nameInput}
          {volumeInput}
        </div>
      ) : (
        <>
          {nameInput}
          {children}
          {volumeInput}
        </>
      )}

      <div className={`field ${fieldsInline ? "field-col" : ""}`}>
        <label htmlFor="cf-type">Tipo de recipiente</label>
        <select
          id="cf-type"
          value={value.container_type || "custom"}
          onChange={(e) => set({ container_type: e.target.value })}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <p className="setup-hint">
          {isTrackingType
            ? "Se registra por tomas parciales y su nivel se reinicia cada día."
            : "Los termos, jarras y botellones se registrarán por tomas parciales (nivel restante)."}
        </p>
      </div>

      <div className={`field ${fieldsInline ? "field-col" : ""}`}>
        <label htmlFor="cf-content">¿Qué contiene?</label>
        <div className="container-content-select">
          <span className="container-content-select__icon">
            <DrinkIcon type={content.id} size={18} />
          </span>
          <select
            id="cf-content"
            value={content.id}
            onChange={(e) => set({ drink_type: e.target.value })}
          >
            {DRINK_TYPES.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
        {content.factor < 1 && (
          <p className="setup-hint">
            {content.label} hidrata al {Math.round(content.factor * 100)}% del agua — cada toma se descuenta con
            ese factor.
          </p>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      <div className="container-form-actions">
        {editing && (
          <button type="button" className="btn-ghost" onClick={onCancelEdit}>
            Cancelar
          </button>
        )}
        <button className={submitClass} type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}