"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { get, getToken, setToken } from "./api";
import type { Me } from "./types";

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

async function fetchMe(): Promise<Me | null> {
  if (!getToken()) return null;
  return get<Me>("/auth/me").catch(() => null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const m = await fetchMe();
    setMe(m);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMe().then((m) => {
      setMe(m);
      setLoading(false);
    });
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
    // full reload clears all client state
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }, []);

  return <Ctx.Provider value={{ me, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
