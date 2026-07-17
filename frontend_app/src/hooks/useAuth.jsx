import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, clearTokens, isLoggedIn, setTokens } from "../lib/apiClient.js";
import { performLogout, subscribeToSessionInvalidation } from "../lib/authSession.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [authenticated, setAuthenticated] = useState(isLoggedIn());

  useEffect(
    () =>
      subscribeToSessionInvalidation(() => {
        setAuthenticated(false);
        queryClient.clear();
      }),
    [queryClient],
  );

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

  const logout = useCallback(({ redirect = true } = {}) => {
    performLogout({ clearSession: clearTokens, redirect });
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
