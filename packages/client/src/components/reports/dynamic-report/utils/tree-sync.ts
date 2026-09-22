/**
 * Coordination between the report's two tree effects.
 *
 * Effect 1 rebuilds both trees when the template or sort codes load. Effect 2 patches leaf values
 * when the figures or the zeroed filter change, deliberately preserving structure so a user's
 * drags and renames survive a filter change. When Effect 1 has just rebuilt from the same figures,
 * Effect 2 must stand down: it reads the tree from before Effect 1's setState and would write that
 * stale copy back over the fresh rebuild.
 *
 * The inputs Effect 1 built from are what decides this, not a counter of how often it ran. The two
 * effects watch queries that resolve independently — the template usually lands before the much
 * slower ledger aggregation, and sort codes land whenever they land — so Effect 1 routinely runs
 * in commits where Effect 2 does not. A counter bumped by Effect 1 and consumed by Effect 2 drifts
 * apart across those commits, and the skip meant for one of them is spent on the next real update
 * instead: on a page refresh that is the arrival of the figures, leaving every leaf hidden with no
 * entities and no amounts under the branches.
 */
export type TreeBuildInputs = {
  /** Compared by reference: a new array means new figures. */
  businessSums: readonly unknown[];
  showZeroed: boolean;
};

/** True when Effect 1 already rebuilt the trees from exactly these inputs. */
export function isBuiltFrom(built: TreeBuildInputs | null, current: TreeBuildInputs): boolean {
  return (
    built !== null &&
    built.businessSums === current.businessSums &&
    built.showZeroed === current.showZeroed
  );
}
