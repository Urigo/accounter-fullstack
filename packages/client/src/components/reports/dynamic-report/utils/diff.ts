import { REPORT_ROOT } from './report-tree.js';
import { buildNodeStats, type CustomData, type FlatNode, type NodeStats } from './types.js';

/**
 * Values are formatted with `maximumFractionDigits: 0`, so anything that rounds to ₪0 would render
 * as a delta badge reading "0". Treat those as unchanged: they are floating-point noise, not news.
 */
export const DELTA_THRESHOLD = 0.5;

/** The persisted shape of a report node, as stored in a snapshot and returned by GraphQL. */
export type BaselineNode = {
  id: string;
  parent: string;
  text: string;
  droppable: boolean;
  data: {
    nodeType: string;
    isOpen: boolean;
    hebrewText?: string | null;
    sortCode?: number | null;
  };
};

export type Baseline = {
  tree: BaselineNode[];
  /** Leaf values only, keyed by financial entity id. Branch sums are recomputed from these. */
  values: Map<string, number>;
};

export type NodeChange =
  | { kind: 'value'; previous: number; delta: number }
  | { kind: 'added' }
  | { kind: 'removed'; previousValue: number }
  | { kind: 'moved'; previousParentText: string }
  | { kind: 'renamed'; previousText: string };

export type ReportDiff = {
  /** Changes affecting each node, keyed by node id. Nodes with no changes are absent. */
  byNodeId: Map<string, NodeChange[]>;
  /**
   * Rolled-up value delta per node, so a change buried deep in a collapsed subtree is visible from
   * its ancestors. Sub-threshold entries are omitted.
   */
  subtreeDelta: Map<string, number>;
  /** Nodes present in the baseline but gone now, for rendering in their old position. */
  ghosts: FlatNode<CustomData>[];
};

const BRANCH_NODE_TYPES = new Set(['sort-code-branch', 'synthetic-branch']);

function asNodeType(droppable: boolean, raw: string): CustomData['nodeType'] {
  if (!droppable) return 'financial-entity';
  return BRANCH_NODE_TYPES.has(raw) ? (raw as CustomData['nodeType']) : 'synthetic-branch';
}

/**
 * Rebuilds the tree as it stood at the save, so both sides of the diff can go through the same
 * `buildNodeStats` pass rather than a second, separately-maintained summing implementation.
 */
function rehydrateBaseline(baseline: Baseline): FlatNode<CustomData>[] {
  return baseline.tree.map(node => ({
    id: node.id,
    parent: node.parent,
    text: node.text,
    droppable: node.droppable,
    data: {
      nodeType: asNodeType(node.droppable, node.data.nodeType),
      isOpen: node.data.isOpen,
      // A leaf absent from the value map had no ledger activity in the snapshot's period.
      ...(node.droppable ? {} : { value: baseline.values.get(node.id) ?? 0 }),
      ...(node.data.hebrewText == null ? {} : { hebrewText: node.data.hebrewText }),
      ...(node.data.sortCode == null ? {} : { sortCode: node.data.sortCode }),
    },
  }));
}

/** Human-readable name of a node's parent, for "moved from …". */
function parentLabel(parentId: string, byId: Map<string, { text: string }>): string {
  if (parentId === REPORT_ROOT) return 'Report';
  return byId.get(parentId)?.text ?? parentId;
}

function subtree(stats: NodeStats, id: string): number {
  return stats.get(id)?.sum ?? 0;
}

/**
 * Compares the report as it stands against the baseline captured at the last save.
 *
 * Leaves join on their financial entity id and branches on their node id — both stable across
 * saves. Sibling order is deliberately not compared: it is implicit array position with nothing
 * persisted to anchor it, so every reorder would read as a change to every following sibling.
 */
export function buildReportDiff(current: FlatNode<CustomData>[], baseline: Baseline): ReportDiff {
  const baselineTree = rehydrateBaseline(baseline);

  const currentById = new Map(current.map(node => [node.id, node]));
  const baselineById = new Map(baselineTree.map(node => [node.id, node]));

  const currentStats = buildNodeStats(current);
  const baselineStats = buildNodeStats(baselineTree);

  const byNodeId = new Map<string, NodeChange[]>();
  const subtreeDelta = new Map<string, number>();
  const ghosts: FlatNode<CustomData>[] = [];

  const record = (id: string, change: NodeChange): void => {
    const existing = byNodeId.get(id);
    if (existing) {
      existing.push(change);
    } else {
      byNodeId.set(id, [change]);
    }
  };

  for (const node of current) {
    const before = baselineById.get(node.id);

    if (before) {
      if (!node.droppable) {
        const previous = before.data.value ?? 0;
        const delta = (node.data.value ?? 0) - previous;
        if (Math.abs(delta) >= DELTA_THRESHOLD) {
          record(node.id, { kind: 'value', previous, delta });
        }
      }
      if (before.parent !== node.parent) {
        record(node.id, {
          kind: 'moved',
          previousParentText: parentLabel(before.parent, baselineById),
        });
      }
      // Only branches are renamed by the user; a leaf's text is the entity's name, which can change
      // upstream in the ledger without the report having changed at all.
      if (node.droppable && before.text !== node.text) {
        record(node.id, { kind: 'renamed', previousText: before.text });
      }
    } else {
      record(node.id, { kind: 'added' });
    }

    const delta = subtree(currentStats, node.id) - subtree(baselineStats, node.id);
    if (Math.abs(delta) >= DELTA_THRESHOLD) {
      subtreeDelta.set(node.id, delta);
    }
  }

  for (const node of baselineTree) {
    if (currentById.has(node.id)) continue;

    record(node.id, { kind: 'removed', previousValue: subtree(baselineStats, node.id) });
    ghosts.push(node);

    // A removed subtree contributes its whole baseline sum as a loss, which is what explains the
    // drop in whatever ancestor still exists.
    const delta = -subtree(baselineStats, node.id);
    if (Math.abs(delta) >= DELTA_THRESHOLD) {
      subtreeDelta.set(node.id, delta);
    }
  }

  return { byNodeId, subtreeDelta, ghosts };
}

/** Entity ids that have ledger activity now but were absent from the baseline entirely. */
export function findNewEntityIds(entityIds: Iterable<string>, baseline: Baseline): Set<string> {
  const known = new Set(baseline.tree.map(node => node.id));
  for (const id of baseline.values.keys()) {
    known.add(id);
  }

  const fresh = new Set<string>();
  for (const id of entityIds) {
    if (!known.has(id)) fresh.add(id);
  }
  return fresh;
}
