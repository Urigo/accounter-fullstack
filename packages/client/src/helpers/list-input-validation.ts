/**
 * Client-side guards for list-of-string form inputs (emails, auto-match
 * phrases, …). Mirrors the server-side rules in
 * `financial-entities/helpers/list-input-validation.helper.ts` so the user gets
 * immediate feedback before the mutation is sent.
 *
 * All comparisons are done on a normalized (trimmed, lower-cased) form.
 */

export function normalizeEntry(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Message to show when `value` would duplicate an existing entry
 * (case-insensitive), or `null` when it is safe to add.
 */
export function duplicateEntryError(list: readonly string[], value: string): string | null {
  const candidate = normalizeEntry(value);
  return list.some(item => normalizeEntry(item) === candidate)
    ? `"${value.trim()}" is already in the list`
    : null;
}

/**
 * Message to show when `value` conflicts with an existing phrase — either a
 * duplicate or a substring overlap (e.g. "GOOGL" vs "GOOGLE") — or `null` when
 * it is safe to add.
 */
export function phraseConflictError(list: readonly string[], value: string): string | null {
  const candidate = normalizeEntry(value);
  if (candidate === '') {
    return null;
  }
  for (const item of list) {
    const existing = normalizeEntry(item);
    if (existing === '') {
      continue;
    }
    if (existing === candidate) {
      return `"${value.trim()}" is already in the list`;
    }
    if (existing.includes(candidate)) {
      return `"${value.trim()}" is already covered by "${item}"`;
    }
    if (candidate.includes(existing)) {
      return `"${value.trim()}" overlaps with "${item}" — remove the broader phrase first`;
    }
  }
  return null;
}

/** True when every entry in the list is unique (case-insensitive). */
export function hasNoDuplicateEntries(list: readonly string[]): boolean {
  return new Set(list.map(normalizeEntry)).size === list.length;
}

/** True when no phrase is a duplicate or substring of another. */
export function hasNoPhraseOverlap(list: readonly string[]): boolean {
  const normalized = list.map(normalizeEntry).filter(entry => entry !== '');
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      if (normalized[i].includes(normalized[j]) || normalized[j].includes(normalized[i])) {
        return false;
      }
    }
  }
  return true;
}
