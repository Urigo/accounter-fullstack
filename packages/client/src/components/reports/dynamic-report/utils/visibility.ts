/**
 * A render-time overlay on the report tree: which rows render, and which branches render open
 * whatever their saved isOpen says. It never touches the nodes, so the template is unchanged.
 * Needs review is one; a layer that reveals a row (e.g. opening a comment thread) is another.
 *
 * A row renders only under a rendered parent, so an overlay that shows a row lists its ancestors
 * too, and force-opens them.
 */
export type RowVisibility = {
  /**
   * The rows this overlay shows. `null` means every row: the overlay narrows nothing and only
   * force-opens branches.
   */
  visibleIds: Set<string> | null;
  /** Branches rendered open whatever their saved isOpen says. */
  forceOpenIds: Set<string>;
};

/**
 * Combines two overlays into one; a row renders when either overlay shows it.
 *
 * - An absent overlay (`null`) changes nothing: the other one is returned as it is, so a memoised
 *   overlay keeps its identity. Two absent overlays give `null`.
 * - `visibleIds` is the union of both sets. `null` is "every row", so it absorbs any set: merging
 *   an overlay that shows every row with one that narrows gives an overlay that narrows nothing.
 *   A layer that means to add rows to another's narrowed view therefore lists them rather than
 *   passing `null`.
 * - `forceOpenIds` is always the union of both.
 *
 * The inputs are never mutated. The merge is commutative and associative.
 */
export function mergeVisibility(
  a: RowVisibility | null,
  b: RowVisibility | null,
): RowVisibility | null {
  if (!a) return b;
  if (!b) return a;
  return {
    visibleIds:
      a.visibleIds === null || b.visibleIds === null
        ? null
        : new Set([...a.visibleIds, ...b.visibleIds]),
    forceOpenIds: new Set([...a.forceOpenIds, ...b.forceOpenIds]),
  };
}

/** Whether an overlay narrows the rows at all; false for no overlay or one that shows every row. */
export function isNarrowing(visibility: RowVisibility | null): boolean {
  return !!visibility && visibility.visibleIds !== null;
}
