import { useLayoutEffect, useRef, type RefObject } from 'react';

function normalize(text: string): string {
  return text.toLocaleLowerCase().trim().replaceAll(/\s+/g, ' ');
}

const WORD_BOUNDARY = /[\s\-_/\\.,:;'"()[\]{}&+#@|]/;

function scoreHaystack(haystack: string, search: string): number {
  if (haystack.startsWith(search)) return 1;
  let index = haystack.indexOf(search);
  if (index === -1) return 0;
  while (index !== -1) {
    if (WORD_BOUNDARY.test(haystack.charAt(index - 1))) return 0.75;
    index = haystack.indexOf(search, index + 1);
  }
  return 0.5;
}

/**
 * A `filter` for cmdk's `Command` that matches case-insensitively, by substring, and ranks
 * prefix matches above word-start matches above any other substring match.
 *
 * cmdk's default filter is a fuzzy scorer over `value` plus `keywords`. Our items set `value`
 * to an internal id (usually a UUID), so short queries fuzzy-matched hex characters of the id
 * and pulled in unrelated options, and letter case nudged the score enough to reorder results.
 * Here, when an item has keywords, only the keywords are searched and `value` is ignored; an
 * item without keywords falls back to its `value` (which cmdk derives from the item's text).
 */
export function commandSearchFilter(value: string, search: string, keywords?: string[]): number {
  const needle = normalize(search);
  if (!needle) return 1;

  const meaningfulKeywords = keywords?.filter(keyword => keyword.trim() !== '') ?? [];
  const haystacks = meaningfulKeywords.length > 0 ? meaningfulKeywords : [value];

  let best = 0;
  for (const haystack of haystacks) {
    best = Math.max(best, scoreHaystack(normalize(haystack), needle));
    if (best === 1) break;
  }
  return best;
}

/**
 * Keeps a cmdk `CommandList` scrolled to the top whenever the search changes.
 *
 * cmdk only scrolls the newly selected item into view (`block: 'nearest'`), and only when the
 * selection actually changed, so a list that had been scrolled stayed mid-way and hid the best
 * matches above the fold. Attach the returned ref to `CommandList`.
 */
export function useCommandListScrollReset(search: string): RefObject<HTMLDivElement | null> {
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [search]);
  return listRef;
}
