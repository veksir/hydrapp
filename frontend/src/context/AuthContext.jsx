import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("hydrapp_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("hydrapp_user");
        localStorage.removeItem("hydrapp_token");
      }
    }
    setReady(true);
  }, []);

  function persist(token, user) {
    localStorage.setItem("hydrapp_token", token);
    localStorage.setItem("hydrapp_user", JSON.stringify(user));
    setUser(user);
  }

  async function login(email, password) {
    const data = await api.login({ email, password });
    persist(data.token, data.user);
  }

  async function register(name, email, password) {
    const data = await api.register({ name, email, password });
    persist(data.token, data.user);
  }

  function logout() {
    localStorage.removeItem("hydrapp_token");
    localStorage.removeItem("hydrapp_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
