import type { CustomData, FlatNode } from './types.js';

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

/** The slice of a business sum the value patch reads. */
export type LeafSum = {
  business: { id: string; name: string };
  total: { raw: number };
  ledgerFingerprint: string;
};

/**
 * Effect 2's value patch: refreshes each report leaf's value, name and fingerprint from the new
 * figures while preserving the tree's structure, so a user's drags and renames survive a filter
 * change. A leaf whose entity has no sum is hidden rather than dropped, and one whose sum reappears
 * is un-hidden — mirroring buildReportTree, so widening the date range brings a leaf back instead
 * of leaving it invisible with a live value. A node with nothing to update is returned as is.
 */
export function patchLeafValues(
  reportTree: FlatNode<CustomData>[],
  businessSums: readonly LeafSum[],
): FlatNode<CustomData>[] {
  const sumById = new Map(businessSums.map(b => [b.business.id, b]));

  return reportTree.map(node => {
    if (node.droppable) return node;
    const sum = sumById.get(node.id);
    const value = sum ? sum.total.raw * -1 : 0;
    const isHidden = sum === undefined;
    const fingerprint = sum?.ledgerFingerprint;
    // Keep the last known name while hidden — there is no sum to read one from.
    const text = sum ? sum.business.name : node.text;
    if (
      node.data.value === value &&
      (node.data.isHidden ?? false) === isHidden &&
      node.data.fingerprint === fingerprint &&
      node.text === text
    ) {
      return node;
    }
    const data: CustomData = { ...node.data, value };
    if (isHidden) {
      data.isHidden = true;
      delete data.fingerprint;
    } else {
      delete data.isHidden;
      data.fingerprint = fingerprint;
    }
    return { ...node, text, data };
  });
}
