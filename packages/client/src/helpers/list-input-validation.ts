/**
 * Client-side guards for list-of-string form inputs (emails, auto-match phrases,
 * internal email links), giving the user immediate feedback before a conflicting
 * entry is added.
 *
 * Comparisons mirror how the server consumes each list: emails are matched
 * case-insensitively, while phrases are matched with a case-sensitive
 * `description.includes(phrase)` and internal links are URL patterns — so those
 * two are compared exactly (after trimming).
 */

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Message to show when `value` would duplicate an existing email
 * (case-insensitive), or `null` when it is safe to add.
 */
export function duplicateEmailError(list: readonly string[], value: string): string | null {
  const candidate = normalizeEmail(value);
  return list.some(item => normalizeEmail(item) === candidate)
    ? `"${value.trim()}" is already in the list`
    : null;
}

/**
 * Message to show when `value` would exactly repeat an existing entry, or `null`
 * when it is safe to add.
 */
export function duplicateExactError(list: readonly string[], value: string): string | null {
  const candidate = value.trim();
  return list.some(item => item.trim() === candidate)
    ? `"${candidate}" is already in the list`
    : null;
}

/**
 * Message to show when `value` conflicts with an existing phrase, or `null` when
 * it is safe to add. Since a phrase matches any description that contains it, a
 * phrase containing another is redundant ("GOOGLE" is covered by "GOOGL"), and a
 * phrase contained in another makes that one redundant.
 */
export function phraseConflictError(list: readonly string[], value: string): string | null {
  const candidate = value.trim();
  if (candidate === '') {
    return null;
  }
  for (const item of list) {
    const existing = item.trim();
    if (existing === '') {
      continue;
    }
    if (existing === candidate) {
      return `"${candidate}" is already in the list`;
    }
    if (candidate.includes(existing)) {
      return `"${candidate}" is already covered by "${existing}"`;
    }
    if (existing.includes(candidate)) {
      return `"${candidate}" is broader than "${existing}" — remove "${existing}" first`;
    }
  }
  return null;
}

/** True when every email in the list is unique (case-insensitive). */
export function hasNoDuplicateEmails(list: readonly string[]): boolean {
  return new Set(list.map(normalizeEmail)).size === list.length;
}

/** True when no phrase repeats or contains another. */
export function hasNoPhraseOverlap(list: readonly string[]): boolean {
  const phrases = list.map(item => item.trim()).filter(phrase => phrase !== '');
  for (let i = 0; i < phrases.length; i++) {
    for (let j = i + 1; j < phrases.length; j++) {
      if (phrases[i].includes(phrases[j]) || phrases[j].includes(phrases[i])) {
        return false;
      }
    }
  }
  return true;
}
