import { useMemo, useState } from 'react';

export type BlockDraft<T> = {
  /** What the editor shows: the draft while editing, otherwise the server's value. */
  value: T;
  /** Whether the editor holds unsaved changes. */
  dirty: boolean;
  /** Replaces the draft (starting one from the shown value on the first edit). */
  update: (next: (current: T) => T) => void;
  /** Drops the draft, back to the server's value. */
  cancel: () => void;
  /** Keeps the saved draft on screen until the refreshed report arrives, then drops it. */
  markSaved: () => void;
  /** Why the draft cannot be saved, shown under the editor; cleared by the next edit. */
  error: string | null;
  setError: (error: string | null) => void;
};

/**
 * The draft of one profile block. `serverValue` is the block as the report query returned it; a
 * new reference means a refreshed report. The page stays mounted while it refreshes, so a draft
 * survives a refresh another editor triggered; it is dropped only after its own save, once the
 * refreshed value arrives (so the saved rows do not flicker back to the old ones meanwhile).
 */
export function useBlockDraft<S, T>(serverValue: S, fromServer: (value: S) => T): BlockDraft<T> {
  // `fromServer` may assign fresh row ids, so it runs once per server value
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `fromServer` is a pure mapping
  const initial = useMemo(() => fromServer(serverValue), [serverValue]);
  const [draft, setDraft] = useState<T | null>(null);
  const [savedFrom, setSavedFrom] = useState<{ value: S } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Adjusting state while rendering: the refreshed report replaces the saved draft
  if (savedFrom && savedFrom.value !== serverValue) {
    setSavedFrom(null);
    setDraft(null);
  }

  return {
    value: draft ?? initial,
    dirty: draft !== null && !savedFrom,
    update: next => {
      setError(null);
      setSavedFrom(null);
      setDraft(current => next(current ?? initial));
    },
    cancel: () => {
      setError(null);
      setSavedFrom(null);
      setDraft(null);
    },
    markSaved: () => {
      setError(null);
      setSavedFrom({ value: serverValue });
    },
    error,
    setError,
  };
}
