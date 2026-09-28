// Type-only, so types.ts can build buildNodeStats on this without an import cycle.
import type { CustomData, FlatNode } from './types.js';

/**
 * One post-order pass over a flat report tree, folding a per-leaf value up into every branch. It is
 * the shared walk behind each per-node layer that summarises a subtree: sums and leaf counts
 * (`buildNodeStats`), approval counts (`buildApprovalStats`), and whatever layer comes next.
 *
 * - A **leaf** is a financial-entity node. `leaf(node)` gives its value, or null to skip it: a
 *   skipped leaf gets no entry and contributes nothing to its ancestors (hidden leaves, for a layer
 *   that ignores them). Anything a leaf node has under it is ignored.
 * - A **branch** is every other node. Its value is `empty(branch)` folded with each child's value,
 *   in the children's array order: `combine(combine(empty(branch), c1), c2)…`. Every branch gets an
 *   entry, including one with no children or only skipped leaves under it. `empty` receives the
 *   branch so a layer that annotates branches themselves can seed the fold with the branch's own
 *   contribution; a layer that doesn't just ignores the argument.
 *
 * `combine` may mutate and return `acc`, which is always a fresh `empty()` result owned by that
 * branch, but must not mutate `child`: a child's value is the same object stored in the result.
 *
 * Each node is computed once and memoised by id, so the pass is O(N). Nodes are grouped under their
 * parent by id, exactly as the tree renders them: an id that appears twice under one parent is
 * folded in twice, and the node that wins for the id is the last one in the array.
 *
 * @returns a map from node id to its rolled-up value, for every node except skipped leaves.
 */
export function rollup<T>(
  nodes: readonly FlatNode<CustomData>[],
  leaf: (node: FlatNode<CustomData>) => T | null,
  combine: (acc: T, child: T) => T,
  empty: (branch: FlatNode<CustomData>) => T,
): Map<string, T> {
  const nodeById = new Map<string, FlatNode<CustomData>>();
  const childrenOf = new Map<string, string[]>();
  for (const node of nodes) {
    nodeById.set(node.id, node);
    const siblings = childrenOf.get(node.parent);
    if (siblings) siblings.push(node.id);
    else childrenOf.set(node.parent, [node.id]);
  }

  const result = new Map<string, T>();
  // Skipped leaves have no entry in the result, so they are remembered apart from it.
  const skipped = new Set<string>();

  function visit(nodeId: string): T | null {
    if (result.has(nodeId)) return result.get(nodeId)!;
    if (skipped.has(nodeId)) return null;

    // Every id visited comes from `nodes` itself, so the lookup can't miss.
    const node = nodeById.get(nodeId)!;

    // The same test as isFinancialEntityNode in types.ts.
    if (node.data.nodeType === 'financial-entity') {
      const value = leaf(node);
      if (value === null) {
        skipped.add(nodeId);
        return null;
      }
      result.set(nodeId, value);
      return value;
    }

    let acc = empty(node);
    for (const childId of childrenOf.get(nodeId) ?? []) {
      const child = visit(childId);
      if (child !== null) acc = combine(acc, child);
    }
    result.set(nodeId, acc);
    return acc;
  }

  for (const node of nodes) {
    visit(node.id);
  }

  return result;
}
