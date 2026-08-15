import { useEffect, useState } from "react";
import { api } from "../api";
import { Thermometer } from "lucide-react";
import { InsightsSkeleton } from "../components/PageSkeletons";

export default function Insights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getInsights().then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <InsightsSkeleton />;
  if (error) return <div className="screen-center error-text">{error}</div>;

  return (
    <div className="insights">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Tu comportamiento</p>
          <h1>Insights</h1>
        </div>
      </header>

      {!data?.has_data ? (
        <p className="setup-hint">
          Todavía no hay suficientes registros. Sigue usando la app unos días y aquí verás tus
          patrones.
        </p>
      ) : (
        <>
          <div className="insights-grid">
            <div className="card insights-stat">
              <p className="insights-stat__label">Promedio (días con registro)</p>
              <p className="insights-stat__value">{(data.week_avg_ml / 1000).toFixed(1)}L</p>
              <p className="insights-stat__sub">últimos 7 días</p>
            </div>
            <div className="card insights-stat">
              <p className="insights-stat__label">Promedio (días con registro)</p>
              <p className="insights-stat__value">{(data.month_avg_ml / 1000).toFixed(1)}L</p>
              <p className="insights-stat__sub">últimos 30 días</p>
            </div>
            <div className="card insights-stat">
              <p className="insights-stat__label">Racha (≥80% de tu meta)</p>
              <p className="insights-stat__value">{data.current_streak_days} días</p>
            </div>
            <div className="card insights-stat">
              <p className="insights-stat__label">Mejor día</p>
              <p className="insights-stat__value">
                {data.best_day ? `${(data.best_day.consumed_ml / 1000).toFixed(1)}L` : "—"}
              </p>
              {data.best_day && (
                <p className="insights-stat__sub">
                  {new Date(data.best_day.date + "T12:00:00").toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "short",
                  })}
                </p>
              )}
            </div>
          </div>

          {data.heat_effect && (
            <div className="card insights-callout">
              <span className="insights-callout__icon"><Thermometer size={18} /></span>
              <p>{data.heat_effect.message}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
