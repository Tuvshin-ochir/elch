"use client";

import { useCallback, useEffect, useState } from "react";
import { get } from "./api";

/** Tiny data hook: GET on mount / path change, with reload(). */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const d = await get<T>(path);
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }, [path]);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    get<T>(path)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Error"));
    return () => {
      alive = false;
    };
  }, [path]);

  return { data, error, loading: data === null && error === null, reload, setData };
}
