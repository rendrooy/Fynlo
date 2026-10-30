"use client";

import type { AuthUserInterface } from "@fynlo/types";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ApiError, getProfileRequest, loginRequest } from "@/services/api";
import {
  AUTH_SESSION_CLEARED_EVENT,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/utils/auth-storage";

/** "unavailable" keeps the session: a network failure is not a sign-out. */
export type AuthStatus =
  "anonymous" | "authenticated" | "loading" | "unavailable";

interface AuthValue {
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  status: AuthStatus;
  user: AuthUserInterface | null;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUserInterface | null>(null);

  const clearSession = useCallback(() => {
    setUser(null);
    setStatus("anonymous");
  }, []);

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      clearSession();
      return;
    }
    setStatus("loading");
    try {
      setUser(await getProfileRequest());
      setStatus("authenticated");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) clearSession();
      else setStatus("unavailable");
    }
  }, [clearSession]);

  useEffect(() => {
    void refresh();
    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, clearSession);
    return () =>
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, clearSession);
  }, [clearSession, refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user: profile } = await loginRequest(email, password);
    setAccessToken(token);
    setUser(profile);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(() => {
    clearAccessToken();
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ refresh, signIn, signOut, status, user }),
    [refresh, signIn, signOut, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
