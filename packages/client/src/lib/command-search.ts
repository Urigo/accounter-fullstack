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
 * Scores `search` against an option's searchable texts: case-insensitive substring matching,
 * with a prefix match (1) above a word-start match (0.75) above any other substring (0.5).
 * Returns 0 for no match and 1 for an empty search. Blank haystacks are skipped.
 */
export function scoreSearch(search: string, haystacks: Array<string | null | undefined>): number {
  const needle = normalize(search);
  if (!needle) return 1;

  let best = 0;
  for (const haystack of haystacks) {
    if (!haystack?.trim()) continue;
    best = Math.max(best, scoreHaystack(normalize(haystack), needle));
    if (best === 1) break;
  }
  return best;
}

/**
 * Filters `options` down to those matching `search` and orders them by `scoreSearch`, breaking
 * ties by their position in `options`. An empty search returns `options` as given.
 *
 * Render the result inside a `Command` with `shouldFilter={false}`. cmdk's own `filter` prop
 * can't give a stable order: cmdk sorts the items as they currently sit in the DOM and skips
 * sorting entirely on an empty search, so with few distinct scores the order of tied results
 * depended on what had been typed before, and clearing the search didn't restore the list.
 * Searching only the given texts also keeps internal ids (cmdk item `value`s, usually UUIDs)
 * out of the match.
 */
export function rankOptions<T>(
  options: readonly T[],
  search: string,
  getHaystacks: (option: T) => Array<string | null | undefined>,
): T[] {
  if (!normalize(search)) return [...options];

  return options
    .map((option, index) => ({ option, index, score: scoreSearch(search, getHaystacks(option)) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.option);
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
