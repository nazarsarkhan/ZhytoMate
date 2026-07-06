import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { apiFetch, clearTokens, isLoggedIn, setTokens } from "../lib/apiClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(isLoggedIn());

  const login = useCallback(async ({ login, password }) => {
    const result = await apiFetch("/auth/login", { method: "POST", body: { login, password } });
    setTokens(result);
    setAuthenticated(true);
    return result.user;
  }, []);

  const register = useCallback(async ({ username, firstName, lastName, email, password }) => {
    const result = await apiFetch("/auth/register", {
      method: "POST",
      body: { username, firstName, lastName, email, password },
    });
    setTokens(result);
    setAuthenticated(true);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({ authenticated, login, register, logout }),
    [authenticated, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
