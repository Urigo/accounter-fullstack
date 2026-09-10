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

function leaf(id: string, parent: string, value: number): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Entity ${id}`,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false, value },
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

function baseline(tree: BaselineNode[], values: Record<string, number> = {}): Baseline {
  return { tree, values: new Map(Object.entries(values)) };
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
