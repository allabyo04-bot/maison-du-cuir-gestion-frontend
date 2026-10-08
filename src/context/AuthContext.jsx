import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const chargerSession = useCallback(async () => {
    const token = localStorage.getItem("gc_token");
    if (!token) { setLoading(false); return; }
    try {
      const me = await api.auth.me();
      setUser(me);
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { chargerSession(); }, [chargerSession]);

  const login = async (loginId, pin) => {
    setError("");
    try {
      const res = await api.auth.login(loginId, pin);
      setToken(res.token);
      setUser(res.user);
      return true;
    } catch (e) {
      setError(e.message || "Identifiant ou PIN incorrect.");
      return false;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const permissions = user?.role?.permissions || {};

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, permissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
