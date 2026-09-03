import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/** Reads and revives the value stored under `storageKey`, falling back on anything unexpected. */
function readStored<T>(
  storageKey: string,
  fallback: T,
  revive: (parsed: unknown, fallback: T) => T,
): T {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored == null ? fallback : revive(JSON.parse(stored), fallback);
  } catch {
    return fallback;
  }
}

/**
 * `useState` whose value is mirrored to `localStorage`, so it survives a page refresh.
 *
 * Intended for table preferences (sorting, column visibility, ...) that a user expects to stick
 * between visits. Storage access is fully guarded: a disabled/full `localStorage` or a stale,
 * corrupt entry simply falls back to `fallback` instead of crashing the screen.
 *
 * `revive` maps the raw parsed JSON back to state — use it to validate the stored shape (it may
 * come from an older version of the app) and to merge it with the current defaults. Returning
 * `fallback` from it discards the stored value.
 *
 * A changed `storageKey` re-hydrates from that key rather than persisting the old key's value
 * under it, so the hook stays correct when the key is derived (e.g. per user or per screen).
 */
export function usePersistentState<T>(
  storageKey: string,
  fallback: T,
  revive: (parsed: unknown, fallback: T) => T = parsed => parsed as T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => readStored(storageKey, fallback, revive));
  const [hydratedKey, setHydratedKey] = useState(storageKey);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn(`Failed to persist "${storageKey}" to localStorage:`, error);
    }
  }, [storageKey, state]);

  // Updating state during render is React's supported pattern for deriving state from arguments:
  // it re-runs this component before committing, so the stale value is never rendered. Returning
  // the fresh value keeps this render pass consistent too.
  if (hydratedKey !== storageKey) {
    const hydrated = readStored(storageKey, fallback, revive);
    setHydratedKey(storageKey);
    setState(hydrated);
    return [hydrated, setState];
  }

  return [state, setState];
}
