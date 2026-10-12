/**
 * Lossless de-duplication for the list fields of a business' suggestion data.
 *
 * Every rule here must leave matching behavior unchanged, so the comparison
 * mirrors how each list is consumed:
 *  - recognition emails are matched case-insensitively (`emailMatchesPattern`),
 *    so case-variants of the same address are true duplicates;
 *  - phrases are matched with a case-sensitive `description.includes(phrase)`
 *    (transaction and charge suggestions), and internal email links are URL
 *    patterns, so only exact repeats are redundant there.
 *
 * Overlapping phrases (e.g. "GOOGL" vs "GOOGLE") are deliberately left alone:
 * the UI blocks adding them, but dropping either one on write could change
 * which transactions match.
 */

/** Remove duplicate entries ignoring case and surrounding whitespace, keeping the first occurrence. */
export function dedupeCaseInsensitive(list: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list) {
    const key = item.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/** Remove exact repeats, keeping the first occurrence. */
export function dedupeExact(list: readonly string[]): string[] {
  return Array.from(new Set(list));
}
