import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * `useState` whose value is mirrored to `localStorage`, so it survives a page refresh.
 *
 * Intended for table preferences (sorting, column visibility, ...) that a user expects to stick
 * between visits. Storage access is fully guarded: a disabled/full `localStorage` or a stale,
 * corrupt entry simply falls back to `fallback` instead of crashing the screen.
 *
 * `revive` maps the raw parsed JSON back to state — use it to validate the stored shape (it may
 * come from an older version of the app) and to merge it with the current defaults. It runs only
 * on mount; returning `fallback` from it discards the stored value.
 */
export function usePersistentState<T>(
  storageKey: string,
  fallback: T,
  revive: (parsed: unknown, fallback: T) => T = parsed => parsed as T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored == null ? fallback : revive(JSON.parse(stored), fallback);
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn(`Failed to persist "${storageKey}" to localStorage:`, error);
    }
  }, [storageKey, state]);

  return [state, setState];
}
