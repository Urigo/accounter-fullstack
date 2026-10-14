import { useCallback, useRef, useState } from 'react';
import { usePersistentState } from '@/hooks/use-persistent-state.js';

/** The docked column's width, as a ratio of the work area; `null` is the default width. */
export const DOCKED_RATIO_KEY = 'accounter:document-viewer:docked-ratio';
/** The edit sheet's form pane width, as a ratio of the split; `null` is the default 50/50. */
export const EDIT_SPLIT_RATIO_KEY = 'accounter:document-viewer:edit-split-ratio';
/** Whether the edit sheet's viewer pane is collapsed to a strip. */
export const EDIT_PANE_HIDDEN_KEY = 'accounter:document-viewer:edit-pane-hidden';

/**
 * A stored ratio is clamped to this range when read back. The pixel minimums still apply at render;
 * this only keeps a value saved on a very wide screen from starving a narrow one.
 */
export const STORED_RATIO_MIN = 0.2;
export const STORED_RATIO_MAX = 0.8;

/**
 * Revives a stored ratio: `null` means the default, a number strictly between 0 and 1 is clamped to
 * {@link STORED_RATIO_MIN}–{@link STORED_RATIO_MAX}, and anything else (NaN, out of range, a string,
 * an object) falls back.
 */
export function reviveRatio(parsed: unknown, fallback: number | null): number | null {
  if (parsed === null) {
    return null;
  }
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) {
    return fallback;
  }
  return Math.min(STORED_RATIO_MAX, Math.max(STORED_RATIO_MIN, parsed));
}

export function reviveBoolean(parsed: unknown, fallback: boolean): boolean {
  return typeof parsed === 'boolean' ? parsed : fallback;
}

export interface PersistedRatio {
  /** What to render: the live drag value while dragging, the stored one otherwise. */
  ratio: number | null;
  /** A drag in progress. Kept in local state only, so storage isn't written on every move. */
  preview(ratio: number): void;
  /** Ends a drag: stores the last previewed value. A no-op if nothing was previewed. */
  commit(): void;
  /** Stores a value at once (a key press, a reset to `null`). */
  set(ratio: number | null): void;
}

/**
 * A resize ratio remembered in `localStorage` under `storageKey`. `usePersistentState` writes on
 * every state change, so a drag keeps its live value here and commits it on release.
 */
export function usePersistedRatio(storageKey: string): PersistedRatio {
  const [stored, setStored] = usePersistentState<number | null>(storageKey, null, reviveRatio);
  const [live, setLive] = useState<number | null>(null);
  const liveRef = useRef<number | null>(null);

  const preview = useCallback((ratio: number): void => {
    liveRef.current = ratio;
    setLive(ratio);
  }, []);

  const commit = useCallback((): void => {
    const ratio = liveRef.current;
    liveRef.current = null;
    setLive(null);
    if (ratio != null) {
      setStored(ratio);
    }
  }, [setStored]);

  const set = useCallback(
    (ratio: number | null): void => {
      liveRef.current = null;
      setLive(null);
      setStored(ratio);
    },
    [setStored],
  );

  return { ratio: live ?? stored, preview, commit, set };
}
