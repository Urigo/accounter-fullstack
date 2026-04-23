import { describe, expect, it } from 'vitest';
import { isLegacyTemplateNodes, migrateLegacyTemplateNodes } from '../legacy-migration.js';
import type { LegacyTemplateNode } from '../legacy-migration.js';
import { REPORT_ROOT } from '../report-tree.js';
import type { DynamicReportQuery } from '../../../../gql/graphql.js';

// ── fixture helpers ───────────────────────────────────────────────────────────

type BusinessSum = Extract<
  NonNullable<DynamicReportQuery['businessTransactionsSumFromLedgerRecords']>,
  { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
>['businessTransactionsSum'][number];

function legacyBranch(
  id: string | number,
  parent: string | number,
  opts: {
    sortCode?: number;
    descendantFinancialEntities?: string[];
    descendantSortCodes?: number[];
  } = {},
): LegacyTemplateNode {
  return {
    id,
    parent,
    text: String(id),
    droppable: true,
    data: {
      isOpen: false,
      sortCode: opts.sortCode ?? null,
      descendantFinancialEntities: opts.descendantFinancialEntities ?? null,
      descendantSortCodes: opts.descendantSortCodes ?? null,
      mergedSortCodes: null,
    },
  };
}

function legacyLeaf(id: string, parent: string | number): LegacyTemplateNode {
  return { id, parent, text: id, droppable: false, data: { isOpen: false } };
}

function bizSum(id: string, name: string, totalRaw: number): BusinessSum {
  return {
    business: { __typename: 'LtdFinancialEntity', id, name, sortCode: null },
    credit: { __typename: 'FinancialAmount', formatted: '', raw: 0 },
    debit: { __typename: 'FinancialAmount', formatted: '', raw: 0 },
    total: { __typename: 'FinancialAmount', formatted: '', raw: totalRaw },
  } as BusinessSum;
}

const UUID_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const UUID_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// ── tests ─────────────────────────────────────────────────────────────────────

describe('isLegacyTemplateNodes', () => {
  it('returns true when any node.data has descendantSortCodes key', () => {
    const nodes = [legacyBranch('br-1', 'report', { descendantSortCodes: [100] })];
    expect(isLegacyTemplateNodes(nodes)).toBe(true);
  });

  it('returns false for new-format nodes (no descendantSortCodes key)', () => {
    const nodes: LegacyTemplateNode[] = [
      { id: 'br-1', parent: 'report', text: 'Branch', droppable: true, data: { isOpen: false } },
    ];
    expect(isLegacyTemplateNodes(nodes)).toBe(false);
  });
});

describe('migrateLegacyTemplateNodes', () => {
  describe('sort-code branch + 2 UUIDs in descendantFinancialEntities, both in businessSums', () => {
    const nodes = [
      legacyBranch('br-sc', 'report', {
        sortCode: 100,
        descendantSortCodes: [100],
        descendantFinancialEntities: [UUID_A, UUID_B],
      }),
    ];
    const sums = [bizSum(UUID_A, 'Alpha Corp', 200), bizSum(UUID_B, 'Beta Ltd', -80)];
    const result = migrateLegacyTemplateNodes(nodes, sums);

    it('branch is present with nodeType sort-code-branch', () => {
      const branch = result.find(n => n.id === 'br-sc');
      expect(branch).toBeDefined();
      expect(branch!.data.nodeType).toBe('sort-code-branch');
    });

    it('branch has no hint arrays in output data', () => {
      const branch = result.find(n => n.id === 'br-sc');
      expect(branch!.data).not.toHaveProperty('descendantFinancialEntities');
      expect(branch!.data).not.toHaveProperty('descendantSortCodes');
      expect(branch!.data).not.toHaveProperty('mergedSortCodes');
    });

    it('two explicit leaf nodes are inserted with correct parent', () => {
      const leafA = result.find(n => n.id === UUID_A);
      const leafB = result.find(n => n.id === UUID_B);
      expect(leafA).toBeDefined();
      expect(leafA!.parent).toBe('br-sc');
      expect(leafA!.data.nodeType).toBe('financial-entity');
      expect(leafB).toBeDefined();
      expect(leafB!.parent).toBe('br-sc');
    });

    it('leaf text is hydrated from businessSums', () => {
      expect(result.find(n => n.id === UUID_A)!.text).toBe('Alpha Corp');
      expect(result.find(n => n.id === UUID_B)!.text).toBe('Beta Ltd');
    });
  });

  describe('UUID in descendantFinancialEntities but NOT in businessSums', () => {
    const MISSING = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const nodes = [
      legacyBranch('br-1', 'report', {
        descendantSortCodes: [50],
        descendantFinancialEntities: [UUID_A, MISSING],
      }),
    ];
    const sums = [bizSum(UUID_A, 'Present', 10)];
    const result = migrateLegacyTemplateNodes(nodes, sums);

    it('missing UUID is silently dropped', () => {
      expect(result.find(n => n.id === MISSING)).toBeUndefined();
    });

    it('present UUID is still inserted', () => {
      expect(result.find(n => n.id === UUID_A)).toBeDefined();
    });
  });

  describe('synthetic branch (no sortCode)', () => {
    it('nodeType is synthetic-branch', () => {
      const nodes = [
        legacyBranch('synth', 'report', { descendantSortCodes: [10] }),
      ];
      const result = migrateLegacyTemplateNodes(nodes, []);
      expect(result.find(n => n.id === 'synth')!.data.nodeType).toBe('synthetic-branch');
    });
  });

  describe('parent: 0 → REPORT_ROOT', () => {
    it('branch with parent 0 gets parent = REPORT_ROOT', () => {
      const nodes = [legacyBranch('br-1', 0, { descendantSortCodes: [] })];
      const result = migrateLegacyTemplateNodes(nodes, []);
      expect(result.find(n => n.id === 'br-1')!.parent).toBe(REPORT_ROOT);
    });

    it('explicit leaf with parent 0 gets parent = REPORT_ROOT', () => {
      const nodes = [legacyLeaf(UUID_A, 0)];
      const result = migrateLegacyTemplateNodes(nodes, [bizSum(UUID_A, 'Root Leaf', 5)]);
      expect(result.find(n => n.id === UUID_A)!.parent).toBe(REPORT_ROOT);
    });
  });
});
