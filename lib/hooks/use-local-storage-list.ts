"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function notify() {
  for (const listener of listeners) listener();
}

const EMPTY: unknown[] = [];

/**
 * Hydration-safe localStorage-backed list, built on useSyncExternalStore —
 * the API React ships specifically for subscribing to state that lives
 * outside React (here: the browser's localStorage). This sidesteps the usual
 * "read in an effect, setState after mount" dance entirely: the server
 * snapshot is an empty list, and React reconciles the real client snapshot
 * for us without any manual setState-in-effect.
 */
export function useLocalStorageList<T>(key: string, max = 20) {
  const cache = useRef<{ raw: string | null | undefined; parsed: T[] }>({ raw: undefined, parsed: [] });

  const getSnapshot = useCallback((): T[] => {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }
    if (raw === cache.current.raw) return cache.current.parsed;
    let parsed: T[] = [];
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = [];
      }
    }
    cache.current = { raw, parsed };
    return parsed;
  }, [key]);

  const getServerSnapshot = useCallback((): T[] => EMPTY as T[], []);

  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = typeof window !== "undefined";

  const persist = useCallback(
    (next: T[]) => {
      const trimmed = next.slice(0, max);
      try {
        window.localStorage.setItem(key, JSON.stringify(trimmed));
      } catch {
        // Storage full or unavailable — the in-memory snapshot still updates for this session.
      }
      notify();
    },
    [key, max]
  );

  const add = useCallback(
    (item: T, dedupeKey?: (item: T) => string) => {
      const current = getSnapshot();
      const next = dedupeKey
        ? [item, ...current.filter((existing) => dedupeKey(existing) !== dedupeKey(item))]
        : [item, ...current];
      persist(next);
    },
    [getSnapshot, persist]
  );

  const remove = useCallback(
    (predicate: (item: T) => boolean) => {
      persist(getSnapshot().filter((item) => !predicate(item)));
    },
    [getSnapshot, persist]
  );

  const clear = useCallback(() => persist([]), [persist]);

  return { items, hydrated, add, remove, clear };
}
