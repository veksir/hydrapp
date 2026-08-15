// Siluetas de carga por página, armadas con las mismas clases de layout
// que ya existen (.dashboard, .card, .insights-grid, etc.) para que el
// espaciado real coincida con el contenido que las reemplaza y no haya
// un "salto" al terminar de cargar. Cada una es intencionalmente simple
// (unos pocos SkeletonBlock/SkeletonCircle) — no intentan clonar cada
// pixel del contenido real, solo dar una referencia de forma mientras
// se espera la respuesta del backend.
import { SkeletonBlock, SkeletonCircle, SkeletonGroup } from "./Skeleton";

export function DashboardSkeleton() {
  return (
    <SkeletonGroup label="Cargando tu progreso" className="dashboard">
      <header className="dashboard__header">
        <div>
          <SkeletonBlock width="90px" height="12px" style={{ marginBottom: 8 }} />
          <SkeletonBlock width="160px" height="24px" />
        </div>
      </header>

      <section className="card dashboard__goal-explainer">
        <SkeletonBlock width="70%" height="14px" style={{ marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 12 }}>
          <SkeletonBlock width="60px" height="12px" />
          <SkeletonBlock width="80px" height="12px" />
          <SkeletonBlock width="60px" height="12px" />
        </div>
      </section>

      <section className="card dashboard__hero" style={{ display: "flex", justifyContent: "center" }}>
        <SkeletonCircle size="180px" />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <SkeletonBlock width="70%" height="11px" style={{ marginBottom: 10 }} />
            <SkeletonBlock width="50%" height="18px" />
          </div>
        ))}
      </div>

      <section className="card" style={{ padding: 20 }}>
        <SkeletonBlock width="120px" height="16px" style={{ marginBottom: 16 }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <SkeletonCircle size="32px" />
            <SkeletonBlock width="100%" height="14px" />
          </div>
        ))}
      </section>
    </SkeletonGroup>
  );
}

export function HistorySkeleton() {
  return (
    <SkeletonGroup label="Cargando historial" className="history">
      <header className="dashboard__header">
        <div>
          <SkeletonBlock width="90px" height="12px" style={{ marginBottom: 8 }} />
          <SkeletonBlock width="140px" height="24px" />
        </div>
      </header>
      <section className="card" style={{ padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {Array.from({ length: 28 }).map((_, i) => (
            <SkeletonCircle key={i} size="100%" style={{ aspectRatio: "1 / 1" }} />
          ))}
        </div>
      </section>
    </SkeletonGroup>
  );
}

export function InsightsSkeleton() {
  return (
    <SkeletonGroup label="Cargando insights" className="insights">
      <header className="dashboard__header">
        <div>
          <SkeletonBlock width="120px" height="12px" style={{ marginBottom: 8 }} />
          <SkeletonBlock width="100px" height="24px" />
        </div>
      </header>
      <div className="insights-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card insights-stat">
            <SkeletonBlock width="80%" height="11px" style={{ marginBottom: 10 }} />
            <SkeletonBlock width="50%" height="22px" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

export function ProfileSkeleton() {
  return (
    <SkeletonGroup label="Cargando tu perfil" className="setup-screen">
      <header className="setup-header">
        <SkeletonBlock width="120px" height="22px" style={{ marginBottom: 8 }} />
        <SkeletonBlock width="180px" height="14px" />
      </header>
      <section className="card setup-form" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <SkeletonBlock width="90px" height="12px" style={{ marginBottom: 8 }} />
            <SkeletonBlock width="100%" height="40px" radius="var(--radius-md)" />
          </div>
        ))}
      </section>
    </SkeletonGroup>
  );
}

export function AssistantSkeleton() {
  return (
    <SkeletonGroup label="Cargando el asistente" className="assistant-screen">
      <header className="dashboard__header">
        <div>
          <SkeletonBlock width="70px" height="12px" style={{ marginBottom: 8 }} />
          <SkeletonBlock width="180px" height="24px" />
        </div>
      </header>
      <SkeletonBlock width="100%" height="80px" radius="var(--radius-lg)" />
    </SkeletonGroup>
  );
}
