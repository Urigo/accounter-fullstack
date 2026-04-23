import { describe, expect, it } from 'vitest';
import { buildInitialBankTree, BANK_ROOT } from '../bank-tree.js';
import type { AllSortCodesQuery, DynamicReportQuery } from '../../../../gql/graphql.js';

// ── fixture helpers ───────────────────────────────────────────────────────────

type SortCode = AllSortCodesQuery['allSortCodes'][number];
type BusinessSum = Extract<
  NonNullable<DynamicReportQuery['businessTransactionsSumFromLedgerRecords']>,
  { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
>['businessTransactionsSum'][number];

function sc(id: string, key: number, name: string): SortCode {
  return { id, key, name, defaultIrsCode: null };
}

function biz(
  id: string,
  name: string,
  totalRaw: number,
  sortCode?: { id: string; key: number; name: string } | null,
): BusinessSum {
  return {
    business: {
      __typename: 'LtdFinancialEntity',
      id,
      name,
      sortCode: sortCode
        ? { __typename: 'SortCode', id: sortCode.id, key: sortCode.key, name: sortCode.name }
        : null,
    },
    credit: { __typename: 'FinancialAmount', formatted: '', raw: 0 },
    debit: { __typename: 'FinancialAmount', formatted: '', raw: 0 },
    total: { __typename: 'FinancialAmount', formatted: '', raw: totalRaw },
  } as BusinessSum;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('buildInitialBankTree', () => {
  it('returns an empty array for empty inputs', () => {
    expect(buildInitialBankTree([], [], new Set(), true)).toEqual([]);
  });

  describe('2 sort codes, 3 entities', () => {
    const sortCodes = [sc('sc-200', 200, 'Revenue'), sc('sc-100', 100, 'Expenses')];
    const sums = [
      biz('e-1', 'Alpha', 100, { id: 'sc-100', key: 100, name: 'Expenses' }),
      biz('e-2', 'Beta', 200, { id: 'sc-200', key: 200, name: 'Revenue' }),
      biz('e-3', 'Gamma', 300, { id: 'sc-100', key: 100, name: 'Expenses' }),
    ];
    const result = buildInitialBankTree(sortCodes, sums, new Set(), true);

    it('contains both sort-code branch nodes', () => {
      const branches = result.filter(n => n.data.nodeType === 'sort-code-branch');
      expect(branches).toHaveLength(2);
    });

    it('sort-code branches are ordered ascending by key', () => {
      const branches = result.filter(n => n.data.nodeType === 'sort-code-branch');
      expect(branches[0].data.sortCode).toBe(100);
      expect(branches[1].data.sortCode).toBe(200);
    });

    it('entities have correct parent sort-code branch', () => {
      const e1 = result.find(n => n.id === 'e-1');
      const e2 = result.find(n => n.id === 'e-2');
      const e3 = result.find(n => n.id === 'e-3');
      expect(e1!.parent).toBe('sc-100');
      expect(e2!.parent).toBe('sc-200');
      expect(e3!.parent).toBe('sc-100');
    });
  });

  describe('entity with no sort code', () => {
    const result = buildInitialBankTree(
      [sc('sc-100', 100, 'Expenses')],
      [
        biz('e-with-sc', 'WithSortCode', 10, { id: 'sc-100', key: 100, name: 'Expenses' }),
        biz('e-no-sc', 'Orphan', 50, null),
      ],
      new Set(),
      true,
    );

    it('entity with no sort code has parent BANK_ROOT', () => {
      expect(result.find(n => n.id === 'e-no-sc')!.parent).toBe(BANK_ROOT);
    });

    it('appears after sort-code branches in the array', () => {
      const branchIdx = result.findIndex(n => n.id === 'sc-100');
      const orphanIdx = result.findIndex(n => n.id === 'e-no-sc');
      expect(orphanIdx).toBeGreaterThan(branchIdx);
    });
  });

  describe('multiple no-sort-code entities are sorted alphabetically', () => {
    const result = buildInitialBankTree(
      [],
      [
        biz('id-c', 'Charlie', 1, null),
        biz('id-a', 'Alpha', 2, null),
        biz('id-b', 'Bravo', 3, null),
      ],
      new Set(),
      true,
    );

    it('first entity alphabetically is Alpha', () => {
      expect(result[0].text).toBe('Alpha');
    });

    it('second is Bravo, third is Charlie', () => {
      expect(result[1].text).toBe('Bravo');
      expect(result[2].text).toBe('Charlie');
    });
  });

  describe('excluded entity', () => {
    const sortCodes = [sc('sc-100', 100, 'Expenses')];
    const sums = [
      biz('e-kept', 'Kept', 100, { id: 'sc-100', key: 100, name: 'Expenses' }),
      biz('e-excluded', 'Excluded', 200, { id: 'sc-100', key: 100, name: 'Expenses' }),
    ];

    it('excluded entity is absent from the result', () => {
      const result = buildInitialBankTree(sortCodes, sums, new Set(['e-excluded']), true);
      expect(result.find(n => n.id === 'e-excluded')).toBeUndefined();
    });

    it('sort-code branch still present when other entities remain', () => {
      const result = buildInitialBankTree(sortCodes, sums, new Set(['e-excluded']), true);
      expect(result.find(n => n.id === 'sc-100')).toBeDefined();
    });

    it('sort-code branch omitted when all its entities are excluded', () => {
      const result = buildInitialBankTree(
        sortCodes,
        sums,
        new Set(['e-kept', 'e-excluded']),
        true,
      );
      expect(result.find(n => n.id === 'sc-100')).toBeUndefined();
    });
  });

  describe('includeZeroed flag', () => {
    const sums = [biz('zero-e', 'ZeroEntity', 0, null), biz('nonzero-e', 'NonZero', 50, null)];

    it('excludes zero-value entity when includeZeroed = false', () => {
      const result = buildInitialBankTree([], sums, new Set(), false);
      expect(result.find(n => n.id === 'zero-e')).toBeUndefined();
    });

    it('includes zero-value entity when includeZeroed = true', () => {
      const result = buildInitialBankTree([], sums, new Set(), true);
      expect(result.find(n => n.id === 'zero-e')).toBeDefined();
    });
  });

  describe('leaf value', () => {
    it('value on leaf node equals total.raw * -1', () => {
      const result = buildInitialBankTree(
        [],
        [biz('e-1', 'Entity', 120, null)],
        new Set(),
        true,
      );
      expect(result.find(n => n.id === 'e-1')!.data.value).toBe(-120);
    });

    it('negative total.raw maps to positive value on leaf', () => {
      const result = buildInitialBankTree(
        [],
        [biz('e-2', 'Entity2', -80, null)],
        new Set(),
        true,
      );
      expect(result.find(n => n.id === 'e-2')!.data.value).toBe(80);
    });
  });
});
