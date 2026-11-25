import { useMemo, useState } from 'react';
import { useForm1214Report } from '../report-context.js';

export type BlockDraft<T> = {
  /** What the editor shows: the draft while editing, otherwise the server's value. */
  value: T;
  /** Whether the shown value differs from the saved one (an edit undone by hand is not dirty). */
  dirty: boolean;
  /** Replaces the draft (starting one from the shown value on the first edit). */
  update: (next: (current: T) => T) => void;
  /** Drops the draft, back to the server's value. */
  cancel: () => void;
  /** Keeps the saved draft on screen until the refreshed report arrives, then drops it. */
  markSaved: () => void;
  /** Marks a field as visited (on blur), so its error shows. */
  touch: (fieldKey: string) => void;
  /** Whether a field's error should show: once it was visited, or a save was attempted. */
  showError: (fieldKey: string) => boolean;
  /** Records a save attempt, so every field's error shows. */
  attemptSave: () => void;
  /** Whether a save was attempted since the last edit session started. */
  saveAttempted: boolean;
};

/** Compares drafts by content: row ids are client-side only. */
function sameContent(a: unknown, b: unknown): boolean {
  const withoutRowIds = (key: string, value: unknown) => (key === 'rowId' ? undefined : value);
  return JSON.stringify(a, withoutRowIds) === JSON.stringify(b, withoutRowIds);
}

/**
 * The draft of one profile block. `serverValue` is the block as the report query returned it; a
 * new reference means a refreshed report. The page stays mounted while it refreshes, so a draft
 * survives a refresh another editor triggered; it is dropped after its own save, once the
 * refreshed value arrives (so the saved rows do not flicker back meanwhile), and when the year
 * changes (a draft belongs to its year).
 */
export function useBlockDraft<S, T>(serverValue: S, fromServer: (value: S) => T): BlockDraft<T> {
  const { year } = useForm1214Report();
  // `fromServer` may assign fresh row ids, so it runs once per server value
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `fromServer` is a pure mapping
  const initial = useMemo(() => fromServer(serverValue), [serverValue]);
  const [draft, setDraft] = useState<T | null>(null);
  const [savedFrom, setSavedFrom] = useState<{ value: S } | null>(null);
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [draftYear, setDraftYear] = useState(year);

  const reset = (): void => {
    setDraft(null);
    setSavedFrom(null);
    setTouched(new Set());
    setSaveAttempted(false);
  };

  // Adjusting state while rendering: the refreshed report replaces the saved draft, and another
  // year drops the draft
  if (draftYear !== year) {
    setDraftYear(year);
    reset();
  } else if (savedFrom && savedFrom.value !== serverValue) {
    reset();
  }

  return {
    value: draft ?? initial,
    dirty: draft !== null && !savedFrom && !sameContent(draft, initial),
    update: next => {
      setSavedFrom(null);
      setDraft(current => next(current ?? initial));
    },
    cancel: reset,
    markSaved: () => {
      setTouched(new Set());
      setSaveAttempted(false);
      setSavedFrom({ value: serverValue });
    },
    touch: fieldKey => {
      if (!touched.has(fieldKey)) {
        setTouched(new Set(touched).add(fieldKey));
      }
    },
    showError: fieldKey => saveAttempted || touched.has(fieldKey),
    attemptSave: () => setSaveAttempted(true),
    saveAttempted,
  };
}
