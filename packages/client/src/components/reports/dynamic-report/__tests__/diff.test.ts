import { describe, expect, it } from 'vitest';
import {
  buildReportDiff,
  DELTA_THRESHOLD,
  findNewEntityIds,
  type Baseline,
  type BaselineNode,
  type NodeChange,
} from '../utils/diff.js';
import { REPORT_ROOT } from '../utils/report-tree.js';
import type { CustomData, FlatNode } from '../utils/types.js';

// ── fixture helpers ───────────────────────────────────────────────────────────

function branch(id: string, parent: string, text = `Branch ${id}`): FlatNode<CustomData> {
  return {
    id,
    parent,
    text,
    droppable: true,
    data: { nodeType: 'synthetic-branch', isOpen: true },
  };
}

function leaf(
  id: string,
  parent: string,
  value: number,
  fingerprint?: string,
): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Entity ${id}`,
    droppable: false,
    data: {
      nodeType: 'financial-entity',
      isOpen: false,
      value,
      ...(fingerprint === undefined ? {} : { fingerprint }),
    },
  };
}

function baseBranch(id: string, parent: string, text = `Branch ${id}`): BaselineNode {
  return {
    id,
    parent,
    text,
    droppable: true,
    data: { nodeType: 'synthetic-branch', isOpen: true },
  };
}

function baseLeaf(id: string, parent: string): BaselineNode {
  return {
    id,
    parent,
    text: `Entity ${id}`,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false },
  };
}

function baseline(
  tree: BaselineNode[],
  values: Record<string, number> = {},
  fingerprints: Record<string, string> = {},
): Baseline {
  return {
    tree,
    values: new Map(Object.entries(values)),
    fingerprints: new Map(Object.entries(fingerprints)),
  };
}

function kinds(changes: NodeChange[] | undefined): string[] {
  return (changes ?? []).map(change => change.kind);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('buildReportDiff', () => {
  it('reports nothing when the tree and its figures are unchanged', () => {
    const current = [branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 100)];
    const diff = buildReportDiff(
      current,
      baseline([baseBranch('br-1', REPORT_ROOT), baseLeaf('e-1', 'br-1')], { 'e-1': 100 }),
    );

    expect(diff.byNodeId.size).toBe(0);
    expect(diff.subtreeDelta.size).toBe(0);
    expect(diff.ghosts).toHaveLength(0);
  });

  describe('value changes', () => {
    const tree = [baseBranch('br-1', REPORT_ROOT), baseLeaf('e-1', 'br-1')];

    it('records the previous value and the signed delta', () => {
      const diff = buildReportDiff([branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 140)], baseline(tree, { 'e-1': 100 }));
      expect(diff.byNodeId.get('e-1')).toEqual([{ kind: 'value', previous: 100, delta: 40 }]);
    });

    it('records a decrease as a negative delta', () => {
      const diff = buildReportDiff([branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 60)], baseline(tree, { 'e-1': 100 }));
      expect(diff.byNodeId.get('e-1')).toEqual([{ kind: 'value', previous: 100, delta: -40 }]);
    });

    it('ignores a delta that would render as ₪0', () => {
      const current = [branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 100 + DELTA_THRESHOLD / 2)];
      const diff = buildReportDiff(current, baseline(tree, { 'e-1': 100 }));
      expect(diff.byNodeId.has('e-1')).toBe(false);
      expect(diff.subtreeDelta.has('br-1')).toBe(false);
    });

    it('keeps a delta exactly at the threshold', () => {
      const current = [branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 100 + DELTA_THRESHOLD)];
      const diff = buildReportDiff(current, baseline(tree, { 'e-1': 100 }));
      expect(kinds(diff.byNodeId.get('e-1'))).toEqual(['value']);
    });

    it('treats a leaf absent from the baseline values as having been zero', () => {
      const diff = buildReportDiff([branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 25)], baseline(tree));
      expect(diff.byNodeId.get('e-1')).toEqual([{ kind: 'value', previous: 0, delta: 25 }]);
    });
  });

  describe('records changes', () => {
    const tree = [baseBranch('br-1', REPORT_ROOT), baseLeaf('e-1', 'br-1')];

    it('flags a leaf whose ledger records changed while its total did not', () => {
      const current = [branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 100, 'fp-new')];
      const diff = buildReportDiff(current, baseline(tree, { 'e-1': 100 }, { 'e-1': 'fp-old' }));
      expect(diff.byNodeId.get('e-1')).toEqual([{ kind: 'records' }]);
    });

    it('flags it when the delta is below the threshold too', () => {
      const current = [
        branch('br-1', REPORT_ROOT),
        leaf('e-1', 'br-1', 100 + DELTA_THRESHOLD / 2, 'fp-new'),
      ];
      const diff = buildReportDiff(current, baseline(tree, { 'e-1': 100 }, { 'e-1': 'fp-old' }));
      expect(kinds(diff.byNodeId.get('e-1'))).toEqual(['records']);
    });

    it('does not flag the branch — the marker belongs to the leaf', () => {
      const current = [branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 100, 'fp-new')];
      const diff = buildReportDiff(current, baseline(tree, { 'e-1': 100 }, { 'e-1': 'fp-old' }));
      expect(diff.byNodeId.has('br-1')).toBe(false);
      expect(diff.subtreeDelta.size).toBe(0);
    });

    it('stays quiet when the fingerprint is unchanged', () => {
      const current = [branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 100, 'fp-same')];
      const diff = buildReportDiff(current, baseline(tree, { 'e-1': 100 }, { 'e-1': 'fp-same' }));
      expect(diff.byNodeId.has('e-1')).toBe(false);
    });

    it('stays quiet when the baseline has no fingerprint (a legacy snapshot)', () => {
      const current = [branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 100, 'fp-new')];
      const diff = buildReportDiff(current, baseline(tree, { 'e-1': 100 }));
      expect(diff.byNodeId.has('e-1')).toBe(false);
    });

    it('flags a leaf that lost all its records while its total stayed at zero', () => {
      const current = [branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 0)];
      const diff = buildReportDiff(current, baseline(tree, { 'e-1': 0 }, { 'e-1': 'fp-old' }));
      expect(kinds(diff.byNodeId.get('e-1'))).toEqual(['records']);
    });

    it('never emits records together with value', () => {
      const current = [branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 140, 'fp-new')];
      const diff = buildReportDiff(current, baseline(tree, { 'e-1': 100 }, { 'e-1': 'fp-old' }));
      expect(kinds(diff.byNodeId.get('e-1'))).toEqual(['value']);
    });

    it('never flags an added leaf, which has no baseline to compare with', () => {
      const current = [branch('br-1', REPORT_ROOT), leaf('e-2', 'br-1', 0, 'fp-new')];
      const diff = buildReportDiff(
        current,
        baseline([baseBranch('br-1', REPORT_ROOT)], {}, { 'e-2': 'fp-old' }),
      );
      expect(kinds(diff.byNodeId.get('e-2'))).toEqual(['added']);
    });

    it('records a move alongside a records change', () => {
      const moved = [
        baseBranch('br-1', REPORT_ROOT),
        baseBranch('br-2', REPORT_ROOT),
        baseLeaf('e-1', 'br-1'),
      ];
      const current = [
        branch('br-1', REPORT_ROOT),
        branch('br-2', REPORT_ROOT),
        leaf('e-1', 'br-2', 100, 'fp-new'),
      ];
      const diff = buildReportDiff(current, baseline(moved, { 'e-1': 100 }, { 'e-1': 'fp-old' }));
      expect(kinds(diff.byNodeId.get('e-1')).toSorted()).toEqual(['moved', 'records']);
    });
  });

  describe('subtree rollup', () => {
    it('surfaces a leaf change on every ancestor, so a collapsed parent still shows it', () => {
      const current = [
        branch('outer', REPORT_ROOT),
        branch('inner', 'outer'),
        leaf('e-1', 'inner', 250),
      ];
      const diff = buildReportDiff(
        current,
        baseline(
          [baseBranch('outer', REPORT_ROOT), baseBranch('inner', 'outer'), baseLeaf('e-1', 'inner')],
          { 'e-1': 100 },
        ),
      );

      expect(diff.subtreeDelta.get('inner')).toBe(150);
      expect(diff.subtreeDelta.get('outer')).toBe(150);
    });

    it('nets off sibling changes that cancel', () => {
      const current = [
        branch('br-1', REPORT_ROOT),
        leaf('e-1', 'br-1', 150),
        leaf('e-2', 'br-1', 50),
      ];
      const diff = buildReportDiff(
        current,
        baseline([baseBranch('br-1', REPORT_ROOT), baseLeaf('e-1', 'br-1'), baseLeaf('e-2', 'br-1')], {
          'e-1': 100,
          'e-2': 100,
        }),
      );

      expect(diff.subtreeDelta.has('br-1')).toBe(false);
      expect(kinds(diff.byNodeId.get('e-1'))).toEqual(['value']);
      expect(kinds(diff.byNodeId.get('e-2'))).toEqual(['value']);
    });
  });

  describe('structural changes', () => {
    it('flags an entity that entered the report', () => {
      const diff = buildReportDiff(
        [branch('br-1', REPORT_ROOT), leaf('e-new', 'br-1', 70)],
        baseline([baseBranch('br-1', REPORT_ROOT)]),
      );
      expect(diff.byNodeId.get('e-new')).toEqual([{ kind: 'added' }]);
      expect(diff.subtreeDelta.get('br-1')).toBe(70);
    });

    it('ghosts an entity that left the report, carrying what it used to contribute', () => {
      const diff = buildReportDiff(
        [branch('br-1', REPORT_ROOT)],
        baseline([baseBranch('br-1', REPORT_ROOT), baseLeaf('e-gone', 'br-1')], { 'e-gone': 80 }),
      );

      expect(diff.byNodeId.get('e-gone')).toEqual([{ kind: 'removed', previousValue: 80 }]);
      expect(diff.ghosts.map(node => node.id)).toEqual(['e-gone']);
      expect(diff.ghosts[0].parent).toBe('br-1');
      expect(diff.subtreeDelta.get('br-1')).toBe(-80);
    });

    it('names the previous parent when an entity moves between branches', () => {
      const current = [
        branch('br-a', REPORT_ROOT, 'Expenses'),
        branch('br-b', REPORT_ROOT, 'Revenue'),
        leaf('e-1', 'br-b', 100),
      ];
      const diff = buildReportDiff(
        current,
        baseline(
          [
            baseBranch('br-a', REPORT_ROOT, 'Expenses'),
            baseBranch('br-b', REPORT_ROOT, 'Revenue'),
            baseLeaf('e-1', 'br-a'),
          ],
          { 'e-1': 100 },
        ),
      );

      expect(diff.byNodeId.get('e-1')).toEqual([{ kind: 'moved', previousParentText: 'Expenses' }]);
    });

    it('explains both branch totals when a move leaves the underlying figure untouched', () => {
      const current = [
        branch('br-a', REPORT_ROOT),
        branch('br-b', REPORT_ROOT),
        leaf('e-1', 'br-b', 100),
      ];
      const diff = buildReportDiff(
        current,
        baseline(
          [baseBranch('br-a', REPORT_ROOT), baseBranch('br-b', REPORT_ROOT), baseLeaf('e-1', 'br-a')],
          { 'e-1': 100 },
        ),
      );

      expect(diff.subtreeDelta.get('br-a')).toBe(-100);
      expect(diff.subtreeDelta.get('br-b')).toBe(100);
    });

    it('labels a move out of the report root readably', () => {
      const current = [branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 10)];
      const diff = buildReportDiff(
        current,
        baseline([baseBranch('br-1', REPORT_ROOT), baseLeaf('e-1', REPORT_ROOT)], { 'e-1': 10 }),
      );
      expect(diff.byNodeId.get('e-1')).toEqual([{ kind: 'moved', previousParentText: 'Report' }]);
    });

    it('flags a renamed branch with its previous name', () => {
      const diff = buildReportDiff(
        [branch('br-1', REPORT_ROOT, 'Operating costs')],
        baseline([baseBranch('br-1', REPORT_ROOT, 'Costs')]),
      );
      expect(diff.byNodeId.get('br-1')).toEqual([{ kind: 'renamed', previousText: 'Costs' }]);
    });

    it('does not treat a leaf whose entity was renamed upstream as a report change', () => {
      const renamed = leaf('e-1', 'br-1', 100);
      renamed.text = 'Entity renamed in the ledger';
      const diff = buildReportDiff(
        [branch('br-1', REPORT_ROOT), renamed],
        baseline([baseBranch('br-1', REPORT_ROOT), baseLeaf('e-1', 'br-1')], { 'e-1': 100 }),
      );
      expect(diff.byNodeId.has('e-1')).toBe(false);
    });

    it('ghosts a removed branch together with its subtree', () => {
      const diff = buildReportDiff(
        [branch('keep', REPORT_ROOT)],
        baseline(
          [
            baseBranch('keep', REPORT_ROOT),
            baseBranch('gone', REPORT_ROOT),
            baseLeaf('e-1', 'gone'),
          ],
          { 'e-1': 30 },
        ),
      );

      expect(diff.ghosts.map(node => node.id).sort()).toEqual(['e-1', 'gone']);
      expect(diff.byNodeId.get('gone')).toEqual([{ kind: 'removed', previousValue: 30 }]);
    });

    it('records both a move and a value change on the same node', () => {
      const current = [branch('br-a', REPORT_ROOT), branch('br-b', REPORT_ROOT), leaf('e-1', 'br-b', 175)];
      const diff = buildReportDiff(
        current,
        baseline(
          [baseBranch('br-a', REPORT_ROOT), baseBranch('br-b', REPORT_ROOT), baseLeaf('e-1', 'br-a')],
          { 'e-1': 100 },
        ),
      );

      expect(kinds(diff.byNodeId.get('e-1')).sort()).toEqual(['moved', 'value']);
    });
  });

  describe('degenerate inputs', () => {
    it('treats an empty baseline as everything being new', () => {
      const current = [branch('br-1', REPORT_ROOT), leaf('e-1', 'br-1', 100)];
      const diff = buildReportDiff(current, baseline([]));

      expect(kinds(diff.byNodeId.get('br-1'))).toEqual(['added']);
      expect(kinds(diff.byNodeId.get('e-1'))).toEqual(['added']);
      expect(diff.ghosts).toHaveLength(0);
    });

    it('treats an emptied report as everything being removed', () => {
      const diff = buildReportDiff(
        [],
        baseline([baseBranch('br-1', REPORT_ROOT), baseLeaf('e-1', 'br-1')], { 'e-1': 100 }),
      );

      expect(diff.ghosts).toHaveLength(2);
      expect(kinds(diff.byNodeId.get('e-1'))).toEqual(['removed']);
    });

    it('handles both sides being empty', () => {
      const diff = buildReportDiff([], baseline([]));
      expect(diff.byNodeId.size).toBe(0);
      expect(diff.ghosts).toHaveLength(0);
    });
  });
});

describe('findNewEntityIds', () => {
  const previous = baseline([baseBranch('br-1', REPORT_ROOT), baseLeaf('placed', 'br-1')], {
    placed: 10,
    'unplaced-but-known': 20,
  });

  it('finds entities absent from the baseline entirely', () => {
    expect(findNewEntityIds(['placed', 'unplaced-but-known', 'brand-new'], previous)).toEqual(
      new Set(['brand-new']),
    );
  });

  it('does not consider an entity new just because it was never placed in the report', () => {
    expect(findNewEntityIds(['unplaced-but-known'], previous).size).toBe(0);
  });

  it('returns nothing for an empty input', () => {
    expect(findNewEntityIds([], previous).size).toBe(0);
  });
});
