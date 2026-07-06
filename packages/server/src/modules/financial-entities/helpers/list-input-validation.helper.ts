/**
 * Shared validation/normalization utilities for list-of-string inputs
 * (recognition emails, internal email links, auto-match phrases, …).
 *
 * Two problems these guard against:
 *  - duplicate entries (case-insensitive), which are meaningless and bloat the
 *    stored data; and
 *  - phrases that are a substring of another phrase (e.g. "GOOGL" vs "GOOGLE"),
 *    where the broader entry silently shadows the more specific one during
 *    auto-matching.
 *
 * Comparison is always done on a normalized (trimmed, lower-cased) form so that
 * "Vendor@Acme.com" and "vendor@acme.com " are treated as the same entry.
 */

/** Normalize an entry for case-insensitive comparison. */
export function normalizeListEntry(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Return the first entry whose normalized form has already appeared earlier in
 * the list, or `null` when every entry is unique.
 */
export function findDuplicateEntry(list: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const item of list) {
    const key = normalizeListEntry(item);
    if (seen.has(key)) {
      return item;
    }
    seen.add(key);
  }
  return null;
}

/** Remove duplicate entries (case-insensitive), keeping the first occurrence. */
export function dedupeList(list: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list) {
    const key = normalizeListEntry(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export type PhraseConflict =
  | { type: 'duplicate'; value: string }
  | { type: 'substring'; shorter: string; longer: string };

/**
 * Detect the first conflict in a phrase list: either an exact (case-insensitive)
 * duplicate, or a phrase whose normalized form is contained within another
 * phrase. Empty/whitespace-only entries are ignored for the substring check.
 */
export function findPhraseConflict(list: readonly string[]): PhraseConflict | null {
  const normalized = list.map(normalizeListEntry);
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i];
      const b = normalized[j];
      if (a === b) {
        return { type: 'duplicate', value: list[j] };
      }
      if (a === '' || b === '') {
        continue;
      }
      if (b.includes(a)) {
        return { type: 'substring', shorter: list[i], longer: list[j] };
      }
      if (a.includes(b)) {
        return { type: 'substring', shorter: list[j], longer: list[i] };
      }
    }
  }
  return null;
}

/**
 * Normalize a phrase list by removing duplicates and any phrase whose normalized
 * form is a substring of another kept phrase (the broader, less specific entry
 * is dropped). Used on automated merge paths where rejecting the whole operation
 * would be wrong.
 */
export function cleanPhrases(list: readonly string[]): string[] {
  const deduped = dedupeList(list);
  const normalized = deduped.map(normalizeListEntry);
  return deduped.filter((_, i) => {
    const current = normalized[i];
    if (current === '') {
      return true;
    }
    return !normalized.some(
      (other, j) => j !== i && other !== current && other.includes(current),
    );
  });
}
