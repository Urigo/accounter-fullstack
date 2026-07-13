import { describe, expect, it } from 'vitest';
import { buildReportTree, REPORT_ROOT } from '../utils/report-tree.js';
import type { DynamicReportQuery } from '../../../../gql/graphql.js';

// ── fixture helpers ───────────────────────────────────────────────────────────

type TemplateNode = Parameters<typeof buildReportTree>[0][number];
type BusinessSum = Extract<
  NonNullable<DynamicReportQuery['businessTransactionsSumFromLedgerRecords']>,
  { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
>['businessTransactionsSum'][number];

function tmplBranch(
  id: string | number,
  parent: string | number,
  nodeType = 'synthetic-branch',
): TemplateNode {
  return { id, parent, text: String(id), droppable: true, data: { nodeType, isOpen: false } };
}

function tmplLeaf(id: string, parent: string | number): TemplateNode {
  return {
    id,
    parent,
    text: id,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false },
  };
}

function bizSum(id: string, name: string, totalRaw: number): BusinessSum {
  return {
    business: {
      __typename: 'LtdFinancialEntity',
      id,
      name,
      sortCode: null,
    },
    credit: { __typename: 'FinancialAmount', formatted: '', raw: 0 },
    debit: { __typename: 'FinancialAmount', formatted: '', raw: 0 },
    total: { __typename: 'FinancialAmount', formatted: '', raw: totalRaw },
  } as BusinessSum;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('buildReportTree', () => {
  it('empty template → empty reportTree and empty placedEntityIds', () => {
    const { reportTree, placedEntityIds } = buildReportTree([], []);
    expect(reportTree).toHaveLength(0);
    expect(placedEntityIds.size).toBe(0);
  });

  describe('1 synthetic branch + 2 entity leaves both in businessSums', () => {
    const template: TemplateNode[] = [
      tmplBranch('br-1', 'report'),
      tmplLeaf('e-1', 'br-1'),
      tmplLeaf('e-2', 'br-1'),
    ];
    const sums = [bizSum('e-1', 'Alpha Corp', 100), bizSum('e-2', 'Beta Ltd', -50)];
    const { reportTree, placedEntityIds } = buildReportTree(template, sums);

    it('reportTree has 3 nodes', () => {
      expect(reportTree).toHaveLength(3);
    });

    it('entity leaves are hydrated with name from businessSums', () => {
      expect(reportTree.find(n => n.id === 'e-1')!.text).toBe('Alpha Corp');
      expect(reportTree.find(n => n.id === 'e-2')!.text).toBe('Beta Ltd');
    });

    it('entity leaves have value = total.raw * -1', () => {
      expect(reportTree.find(n => n.id === 'e-1')!.data.value).toBe(-100);
      expect(reportTree.find(n => n.id === 'e-2')!.data.value).toBe(50);
    });

    it('placedEntityIds contains both entity ids', () => {
      expect(placedEntityIds.has('e-1')).toBe(true);
      expect(placedEntityIds.has('e-2')).toBe(true);
    });
  });

  describe('entity in template NOT in businessSums', () => {
    const template: TemplateNode[] = [
      tmplBranch('br-1', 'report'),
      tmplLeaf('e-exists', 'br-1'),
      tmplLeaf('e-missing', 'br-1'),
    ];
    const sums = [bizSum('e-exists', 'Surviving Entity', 200)];
    const { reportTree, placedEntityIds } = buildReportTree(template, sums);

    it('missing entity leaf is dropped from reportTree', () => {
      expect(reportTree.find(n => n.id === 'e-missing')).toBeUndefined();
    });

    it('placedEntityIds contains only the surviving entity', () => {
      expect(placedEntityIds.has('e-exists')).toBe(true);
      expect(placedEntityIds.has('e-missing')).toBe(false);
    });
  });

  describe('sort-code-branch node with numeric id', () => {
    it('data.sortCode is set to Number(id)', () => {
      const template: TemplateNode[] = [tmplBranch(100, 'report', 'sort-code-branch')];
      const { reportTree } = buildReportTree(template, []);
      const branch = reportTree.find(n => n.id === '100');
      expect(branch).toBeDefined();
      expect(branch!.data.sortCode).toBe(100);
    });
  });

  describe('sort-code-branch node with UUID id and sortCode from the query', () => {
    it('data.sortCode is read straight from the template data, not derived from the id', () => {
      const template: TemplateNode[] = [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          parent: 'report',
          text: 'Sort Code 42',
          droppable: true,
          data: { nodeType: 'sort-code-branch', isOpen: false, sortCode: 42 },
        },
      ];
      const { reportTree } = buildReportTree(template, []);
      const branch = reportTree.find(n => n.id === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(branch).toBeDefined();
      expect(branch!.data.sortCode).toBe(42);
    });
  });

  describe('parent: 0 is replaced with REPORT_ROOT', () => {
    it('branch node with parent 0 gets parent = REPORT_ROOT', () => {
      const template: TemplateNode[] = [tmplBranch('br-1', 0)];
      const { reportTree } = buildReportTree(template, []);
      expect(reportTree.find(n => n.id === 'br-1')!.parent).toBe(REPORT_ROOT);
    });

    it('leaf node with parent 0 gets parent = REPORT_ROOT', () => {
      const template: TemplateNode[] = [tmplLeaf('e-1', 0)];
      const { reportTree } = buildReportTree(template, [bizSum('e-1', 'Root Entity', 10)]);
      expect(reportTree.find(n => n.id === 'e-1')!.parent).toBe(REPORT_ROOT);
    });
  });

  describe('nested branches: parent IDs preserved exactly', () => {
    it('child branch parent points to parent branch id', () => {
      const template: TemplateNode[] = [
        tmplBranch('outer', 'report'),
        tmplBranch('inner', 'outer'),
        tmplLeaf('e-1', 'inner'),
      ];
      const { reportTree } = buildReportTree(template, [bizSum('e-1', 'Nested Entity', 30)]);
      expect(reportTree.find(n => n.id === 'inner')!.parent).toBe('outer');
      expect(reportTree.find(n => n.id === 'e-1')!.parent).toBe('inner');
    });
  });
});
