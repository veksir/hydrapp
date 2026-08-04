import { NavLink } from "react-router-dom";
import { Home, CalendarDays, Plus, BarChart3, Settings } from "lucide-react";

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `bottom-nav__item ${isActive ? "is-active" : ""}`}>
        <Home size={19} strokeWidth={2.2} />
        <span>Inicio</span>
      </NavLink>
      <NavLink to="/historial" className={({ isActive }) => `bottom-nav__item ${isActive ? "is-active" : ""}`}>
        <CalendarDays size={19} strokeWidth={2.2} />
        <span>Historial</span>
      </NavLink>
      <NavLink
        to="/"
        state={{ openLog: true }}
        className="bottom-nav__fab-wrap"
        aria-label="Registrar bebida"
      >
        <span className="bottom-nav__fab">
          <Plus size={22} strokeWidth={2.5} />
        </span>
      </NavLink>
      <NavLink to="/insights" className={({ isActive }) => `bottom-nav__item ${isActive ? "is-active" : ""}`}>
        <BarChart3 size={19} strokeWidth={2.2} />
        <span>Insights</span>
      </NavLink>
      <NavLink to="/perfil" className={({ isActive }) => `bottom-nav__item ${isActive ? "is-active" : ""}`}>
        <Settings size={19} strokeWidth={2.2} />
        <span>Perfil</span>
      </NavLink>
    </nav>
  );
}
