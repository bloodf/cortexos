"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./use-local-storage";

/**
 * Per-page persistent filter chips. Each scope (e.g. "docker", "systemd")
 * stores its own set of active filter ids in localStorage.
 */
export function useSavedFilters(scope: string, defaults: string[] = []) {
  const [active, setActive] = useLocalStorage<string[]>(`cortex.filters.${scope}`, defaults);

  const has = useCallback((id: string) => active.includes(id), [active]);
  const toggle = useCallback(
    (id: string) =>
      setActive((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [setActive],
  );
  const clear = useCallback(() => setActive([]), [setActive]);

  return { active, has, toggle, clear, setActive };
}
