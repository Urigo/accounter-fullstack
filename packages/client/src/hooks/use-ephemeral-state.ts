import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/** Module-level store: lives as long as the loaded app, and dies with it. */
const ephemeralStore = new Map<string, unknown>();

/**
 * `useState` whose value is kept in a module-level store rather than in the component, so it
 * survives unmount/remount — navigating to another screen and back — but is gone after a page
 * refresh (nothing is written to `localStorage`/`sessionStorage`).
 *
 * Intended for transient, session-scoped selections (e.g. which table rows are checked) that
 * should not follow the user into a fresh page load.
 *
 * `key` is read only on mount, so pass a constant one per state slice.
 */
export function useEphemeralState<T>(key: string, fallback: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() =>
    ephemeralStore.has(key) ? (ephemeralStore.get(key) as T) : fallback,
  );

  useEffect(() => {
    ephemeralStore.set(key, state);
  }, [key, state]);

  return [state, setState];
}

/** Drops a stored value, so the next mount starts from its fallback. Exported for tests. */
export function clearEphemeralState(key: string): void {
  ephemeralStore.delete(key);
}
