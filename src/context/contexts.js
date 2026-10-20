import { createContext, useContext } from "react";

export const AuthContext = createContext(null);
export const SettingsContext = createContext({});

export const useAuth = () => useContext(AuthContext);
export const useSettings = () => useContext(SettingsContext);
