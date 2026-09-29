import { describe, expect, it } from 'vitest';
import type { AllSortCodesQuery, DynamicReportQuery } from '../../../../gql/graphql.js';
import { buildInitialBankTree } from '../utils/bank-tree.js';
import { handleCrossTreeDrop } from '../utils/cross-tree-drop.js';
import { moveBranchToBank } from '../utils/move-branch-to-bank.js';
import type { FlatNode, CustomData } from '../utils/types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function leaf(id: string, parent: string): FlatNode<CustomData> {
  return { id, parent, text: id, droppable: false, data: { nodeType: 'financial-entity', isOpen: false } };
}

function branch(id: string, parent: string): FlatNode<CustomData> {
  return { id, parent, text: id, droppable: true, data: { nodeType: 'synthetic-branch', isOpen: false } };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('handleCrossTreeDrop', () => {
  it('leaf dragged bank → report (null instruction): absent from bank, present in report at root', () => {
    const bankTree: FlatNode<CustomData>[] = [leaf('leaf-1', 'bank')];
    const reportTree: FlatNode<CustomData>[] = [];

    const { nextBankTree, nextReportTree } = handleCrossTreeDrop(
      bankTree,
      reportTree,
      { nodeId: 'leaf-1', sourceTreeId: 'bank' },
      'report',
      'report',
      null,
    );

    expect(nextBankTree.find(n => n.id === 'leaf-1')).toBeUndefined();
    const movedNode = nextReportTree.find(n => n.id === 'leaf-1');
    expect(movedNode).toBeDefined();
    expect(movedNode!.parent).toBe('report');
  });

  it('branch + 2 children dragged report → bank (null): all 3 absent from report, present in bank', () => {
    const branchNode = branch('br-1', 'report');
    const child1 = leaf('c-1', 'br-1');
    const child2 = leaf('c-2', 'br-1');
    const reportTree: FlatNode<CustomData>[] = [branchNode, child1, child2];
    const bankTree: FlatNode<CustomData>[] = [];

    const { nextBankTree, nextReportTree } = handleCrossTreeDrop(
      bankTree,
      reportTree,
      { nodeId: 'br-1', sourceTreeId: 'report' },
      'bank',
      'bank',
      null,
    );

    expect(nextReportTree.find(n => n.id === 'br-1')).toBeUndefined();
    expect(nextReportTree.find(n => n.id === 'c-1')).toBeUndefined();
    expect(nextReportTree.find(n => n.id === 'c-2')).toBeUndefined();

    expect(nextBankTree.find(n => n.id === 'br-1')).toBeDefined();
    expect(nextBankTree.find(n => n.id === 'c-1')).toBeDefined();
    expect(nextBankTree.find(n => n.id === 'c-2')).toBeDefined();
    expect(nextBankTree.find(n => n.id === 'br-1')!.parent).toBe('bank');
  });

  it('same-tree reorder-above: node moves to correct position, other tree unchanged', () => {
    const a = leaf('a', 'bank');
    const b = leaf('b', 'bank');
    const c = leaf('c', 'bank');
    const bankTree: FlatNode<CustomData>[] = [a, b, c];
    const reportTree: FlatNode<CustomData>[] = [leaf('r-1', 'report')];

    // Move 'c' above 'a'
    const { nextBankTree, nextReportTree } = handleCrossTreeDrop(
      bankTree,
      reportTree,
      { nodeId: 'c', sourceTreeId: 'bank' },
      'a',
      'bank',
      { type: 'reorder-above', currentLevel: 0, indentPerLevel: 16 },
    );

    const ids = nextBankTree.map(n => n.id);
    expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('a'));
    expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('b'));
    // Report tree untouched
    expect(nextReportTree).toEqual(reportTree);
  });

  it('make-child instruction: dragged node parent set to targetNodeId', () => {
    const branchNode = branch('br-1', 'report');
    const movingLeaf = leaf('leaf-x', 'bank');
    const bankTree: FlatNode<CustomData>[] = [movingLeaf];
    const reportTree: FlatNode<CustomData>[] = [branchNode];

    const { nextReportTree } = handleCrossTreeDrop(
      bankTree,
      reportTree,
      { nodeId: 'leaf-x', sourceTreeId: 'bank' },
      'br-1',
      'report',
      { type: 'make-child', currentLevel: 0, indentPerLevel: 16 },
    );

    const movedNode = nextReportTree.find(n => n.id === 'leaf-x');
    expect(movedNode).toBeDefined();
    expect(movedNode!.parent).toBe('br-1');
  });

  it('drag onto self: trees unchanged', () => {
    const bankTree: FlatNode<CustomData>[] = [leaf('self', 'bank')];
    const reportTree: FlatNode<CustomData>[] = [];

    const { nextBankTree, nextReportTree } = handleCrossTreeDrop(
      bankTree,
      reportTree,
      { nodeId: 'self', sourceTreeId: 'bank' },
      'self',
      'bank',
      null,
    );

    expect(nextBankTree).toEqual(bankTree);
    expect(nextReportTree).toEqual(reportTree);
  });

  it('make-child onto financial-entity leaf: trees unchanged (guard fires)', () => {
    const entityLeaf = leaf('entity-1', 'bank');
    const movingLeaf = leaf('moving', 'bank');
    const bankTree: FlatNode<CustomData>[] = [entityLeaf, movingLeaf];
    const reportTree: FlatNode<CustomData>[] = [];

    const { nextBankTree, nextReportTree } = handleCrossTreeDrop(
      bankTree,
      reportTree,
      { nodeId: 'moving', sourceTreeId: 'bank' },
      'entity-1',
      'bank',
      { type: 'make-child', currentLevel: 0, indentPerLevel: 16 },
    );

    expect(nextBankTree).toEqual(bankTree);
    expect(nextReportTree).toEqual(reportTree);
  });

  it('reparent instruction: dragged node parent updated to ancestor at desiredLevel', () => {
    // Tree: root-branch → mid-branch → leaf-x
    const rootBranch = branch('root-br', 'bank');
    const midBranch = branch('mid-br', 'root-br');
    const leafX = leaf('leaf-x', 'mid-br');
    const bankTree: FlatNode<CustomData>[] = [rootBranch, midBranch, leafX];
    const reportTree: FlatNode<CustomData>[] = [];

    // Reparent 'leaf-x' from level 2 to level 1 (desired=1, current=2) → new parent = 'root-br'
    const { nextBankTree } = handleCrossTreeDrop(
      bankTree,
      reportTree,
      { nodeId: 'leaf-x', sourceTreeId: 'bank' },
      'mid-br',
      'bank',
      { type: 'reparent', currentLevel: 2, desiredLevel: 1, indentPerLevel: 16 },
    );

    const movedNode = nextBankTree.find(n => n.id === 'leaf-x');
    expect(movedNode).toBeDefined();
    expect(movedNode!.parent).toBe('root-br');
  });
});

// ── A sort-code branch in both trees ───────────────────────────────────────────
// A sort-code branch keeps its sort code's id wherever it goes, and buildInitialBankTree excludes
// only placed *leaves*. So once a sort-code branch is in the report, any entity of that sort code
// still unplaced (one with no activity when the branch was dragged, one dragged back out, or one
// shown by the zeroed toggle) makes the next bank rebuild emit a second branch under the same id.

type SortCode = AllSortCodesQuery['allSortCodesByBusiness'][number];
type BusinessSum = Extract<
  NonNullable<DynamicReportQuery['businessTransactionsSumFromLedgerRecords']>,
  { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
>['businessTransactionsSum'][number];

const SORT_CODE = { id: 'owner-1|100', key: 100, name: 'Expenses' };
const sortCodes: SortCode[] = [{ ...SORT_CODE, defaultIrsCode: null }];

function sum(id: string, totalRaw: number): BusinessSum {
  return {
    business: {
      __typename: 'LtdFinancialEntity',
      id,
      name: id,
      sortCode: { __typename: 'SortCode', ...SORT_CODE },
    },
    credit: { __typename: 'FinancialAmount', formatted: '', raw: 0 },
    debit: { __typename: 'FinancialAmount', formatted: '', raw: 0 },
    total: { __typename: 'FinancialAmount', formatted: '', raw: totalRaw },
    ledgerFingerprint: `fp-${id}`,
  } as BusinessSum;
}

function duplicateIds(nodes: FlatNode<CustomData>[]): string[] {
  const seen = new Set<string>();
  return nodes.filter(node => seen.size === seen.add(node.id).size).map(node => node.id);
}

/** Drags the sort-code branch into the report, then rebuilds the bank as Effect 2 does. */
function placeSortCodeBranch(): {
  bankTree: FlatNode<CustomData>[];
  reportTree: FlatNode<CustomData>[];
} {
  // e-2 has no activity yet, so the bank's branch holds only e-1.
  const initialBank = buildInitialBankTree(sortCodes, [sum('e-1', 100)], new Set(), true);
  const placed = handleCrossTreeDrop(
    initialBank,
    [],
    { nodeId: SORT_CODE.id, sourceTreeId: 'bank' },
    'report',
    'report',
    null,
  );
  expect(placed.nextBankTree).toEqual([]);

  // The period changes and e-2 now has activity: the bank rebuild excludes only the placed leaf.
  const reportTree = placed.nextReportTree;
  const placedEntityIds = new Set(reportTree.filter(n => !n.droppable).map(n => n.id));
  const bankTree = buildInitialBankTree(
    sortCodes,
    [sum('e-1', 100), sum('e-2', 200)],
    placedEntityIds,
    true,
  );
  return { bankTree, reportTree };
}

describe('a sort-code branch already in the other tree', () => {
  it('is rebuilt in the bank under the same id while it is in the report', () => {
    const { bankTree, reportTree } = placeSortCodeBranch();
    expect(bankTree.map(n => n.id)).toEqual([SORT_CODE.id, 'e-2']);
    expect(reportTree.map(n => n.id)).toEqual([SORT_CODE.id, 'e-1']);
  });

  it.each([
    ['at the report root', 'report', null],
    ['onto a report row', 'e-1', { type: 'reorder-below', currentLevel: 1, indentPerLevel: 24 }],
  ] as const)(
    'merges into the report’s branch when dragged in again, %s',
    (_where, targetNodeId, instruction) => {
      const { bankTree, reportTree } = placeSortCodeBranch();
      const { nextBankTree, nextReportTree } = handleCrossTreeDrop(
        bankTree,
        reportTree,
        { nodeId: SORT_CODE.id, sourceTreeId: 'bank' },
        targetNodeId,
        'report',
        instruction,
      );

      expect(duplicateIds(nextReportTree)).toEqual([]);
      // The branch the user placed keeps its position and state; the new entity joins it.
      expect(nextReportTree[0]).toBe(reportTree[0]);
      expect(nextReportTree.filter(n => n.parent === SORT_CODE.id).map(n => n.id)).toEqual([
        'e-1',
        'e-2',
      ]);
      expect(nextBankTree).toEqual([]);
    },
  );

  it('changes nothing when dropped onto its namesake, like any drop onto its own id', () => {
    const { bankTree, reportTree } = placeSortCodeBranch();
    const { nextBankTree, nextReportTree } = handleCrossTreeDrop(
      bankTree,
      reportTree,
      { nodeId: SORT_CODE.id, sourceTreeId: 'bank' },
      SORT_CODE.id,
      'report',
      { type: 'make-child', currentLevel: 0, indentPerLevel: 24 },
    );
    expect(nextBankTree).toBe(bankTree);
    expect(nextReportTree).toBe(reportTree);
  });

  it('merges into the bank’s branch when the report’s is dragged back', () => {
    const { bankTree, reportTree } = placeSortCodeBranch();
    const { nextBankTree, nextReportTree } = handleCrossTreeDrop(
      bankTree,
      reportTree,
      { nodeId: SORT_CODE.id, sourceTreeId: 'report' },
      'bank',
      'bank',
      null,
    );

    expect(duplicateIds(nextBankTree)).toEqual([]);
    expect(nextBankTree.filter(n => n.parent === SORT_CODE.id).map(n => n.id)).toEqual([
      'e-2',
      'e-1',
    ]);
    expect(nextReportTree).toEqual([]);
  });

  it('merges a nested sort-code branch when its synthetic parent is deleted to the bank', () => {
    const { bankTree, reportTree } = placeSortCodeBranch();
    const wrapped: FlatNode<CustomData>[] = [
      branch('group', 'report'),
      ...reportTree.map(n => (n.id === SORT_CODE.id ? { ...n, parent: 'group' } : n)),
    ];

    const { nextBankTree, nextReportTree } = moveBranchToBank(wrapped, bankTree, 'group');

    expect(duplicateIds(nextBankTree)).toEqual([]);
    expect(nextBankTree.find(n => n.id === 'group')?.parent).toBe('bank');
    expect(nextBankTree.filter(n => n.parent === SORT_CODE.id).map(n => n.id)).toEqual([
      'e-2',
      'e-1',
    ]);
    expect(nextReportTree).toEqual([]);
  });
});
