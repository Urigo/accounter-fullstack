import { useEffect, useMemo, useState } from 'react';
import { useForm1214Report } from '../report-context.js';

export type BlockDraft<T> = {
  /** What the editor shows: the draft while editing, otherwise the saved value. */
  value: T;
  /** Whether the shown value differs from the saved one. */
  dirty: boolean;
  /** Edits the shown value. An edit that brings it back to the saved value drops the draft. */
  update: (next: (current: T) => T) => void;
  /** Drops the draft and the visited fields, back to the saved value. */
  cancel: () => void;
  /** Keeps the saved draft on screen until the refreshed report arrives, then drops it. */
  markSaved: () => void;
  /** Marks a field as visited (on blur), so its error shows. */
  touch: (fieldKey: string) => void;
  /** Whether a field's error should show: once the field was visited. */
  showError: (fieldKey: string) => boolean;
};

/** Compares drafts by content: row ids are client-side only. */
function sameContent(a: unknown, b: unknown): boolean {
  const withoutRowIds = (key: string, value: unknown) => (key === 'rowId' ? undefined : value);
  return JSON.stringify(a, withoutRowIds) === JSON.stringify(b, withoutRowIds);
}

/**
 * The draft of one profile block, reported to the page as `section`'s dirty state. `serverValue`
 * is the block as the report query returned it; a new reference means a refreshed report. The page
 * stays mounted while it refreshes, so a draft survives a refresh another editor triggered; after
 * its own save it stays on screen until the refreshed value arrives (so the saved rows do not
 * flicker back meanwhile), then the refreshed value replaces it. A draft belongs to its year.
 */
export function useBlockDraft<S, T>(
  section: string,
  serverValue: S,
  fromServer: (value: S) => T,
): BlockDraft<T> {
  const { year, setDirty } = useForm1214Report();
  // `fromServer` may assign fresh row ids, so it runs once per server value
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `fromServer` is a pure mapping
  const initial = useMemo(() => fromServer(serverValue), [serverValue]);
  // What the last save sent, shown until the refreshed report replaces `serverValue`
  const [saved, setSaved] = useState<{ value: T; from: S } | null>(null);
  // Local edits; `null` while showing what is saved
  const [draft, setDraft] = useState<T | null>(null);
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [draftYear, setDraftYear] = useState(year);

  // Adjusting state while rendering: the refreshed report replaces what the last save sent, and
  // another year drops the draft
  if (draftYear !== year) {
    setDraftYear(year);
    setDraft(null);
    setSaved(null);
    setTouched(new Set());
  } else if (saved && saved.from !== serverValue) {
    setSaved(null);
  }

  const savedValue = saved?.value ?? initial;
  const dirty = draft !== null && !sameContent(draft, savedValue);

  useEffect(() => {
    setDirty(section, dirty);
  }, [section, dirty, setDirty]);
  useEffect(() => () => setDirty(section, false), [section, setDirty]);

  return {
    value: draft ?? savedValue,
    dirty,
    update: next =>
      setDraft(current => {
        const edited = next(current ?? savedValue);
        return sameContent(edited, savedValue) ? null : edited;
      }),
    cancel: () => {
      setDraft(null);
      setTouched(new Set());
    },
    markSaved: () => {
      if (draft !== null) {
        setSaved({ value: draft, from: serverValue });
      }
      setDraft(null);
      setTouched(new Set());
    },
    touch: fieldKey => {
      setTouched(current => (current.has(fieldKey) ? current : new Set(current).add(fieldKey)));
    },
    showError: fieldKey => touched.has(fieldKey),
  };
}
