import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { AuthContext, SettingsContext } from "./contexts";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = cargando

  useEffect(() => {
    api("auth")
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null));
  }, []);

  const login = useCallback(async (email, password) => {
    const { user } = await api("auth", { method: "POST", body: { email, password } });
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await api("auth", { method: "DELETE" });
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function SettingsProvider({ children }) {
  const { data, setData } = useApi("settings");
  const value = useMemo(
    () => ({ ...(data || { company_name: "Geoñuble Propiedades" }), loaded: Boolean(data), update: setData }),
    [data, setData]
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
