import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Setup from "./pages/Setup";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import SymptomCheck from "./pages/SymptomCheck";
import Insights from "./pages/Insights";
import Assistant from "./pages/Assistant";
import NotFound from "./pages/NotFound";
import BottomNav from "./components/BottomNav";

function PrivateLayout({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return (
    <>
      <main className="app-main">
        {typeof children === "function" ? children(user) : children}
      </main>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Register />} />
      <Route
        path="/configurar"
        element={
          <PrivateLayout>
            <Setup />
          </PrivateLayout>
        }
      />
      <Route
        path="/perfil"
        element={
          <PrivateLayout>
            <Profile />
          </PrivateLayout>
        }
      />
      <Route
        path="/"
        element={
          <PrivateLayout>{(user) => <Dashboard user={user} />}</PrivateLayout>
        }
      />
      <Route
        path="/historial"
        element={
          <PrivateLayout>
            <History />
          </PrivateLayout>
        }
      />
      <Route
        path="/insights"
        element={
          <PrivateLayout>
            <Insights />
          </PrivateLayout>
        }
      />
      <Route
        path="/sintomas"
        element={
          <PrivateLayout>
            <SymptomCheck />
          </PrivateLayout>
        }
      />
      <Route
        path="/asistente"
        element={
          <PrivateLayout>
            <Assistant />
          </PrivateLayout>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
