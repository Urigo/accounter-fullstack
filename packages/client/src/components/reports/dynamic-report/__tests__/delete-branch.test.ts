import { describe, expect, it } from 'vitest';
import { moveBranchToBank } from '../utils/move-branch-to-bank.js';
import type { FlatNode, CustomData } from '../utils/types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function branch(id: string, parent: string): FlatNode<CustomData> {
  return { id, parent, text: id, droppable: true, data: { nodeType: 'synthetic-branch', isOpen: false } };
}

function leaf(id: string, parent: string): FlatNode<CustomData> {
  return { id, parent, text: id, droppable: false, data: { nodeType: 'financial-entity', isOpen: false } };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('moveBranchToBank', () => {
  describe('report branch deletion', () => {
    // Build a 3-level tree in report: br-1 → [child-A, child-B] → [grand-1 under child-A]
    const reportBranch = branch('br-1', 'report');
    const childA = branch('child-A', 'br-1');
    const childB = leaf('child-B', 'br-1');
    const grand1 = leaf('grand-1', 'child-A');

    const reportTree: FlatNode<CustomData>[] = [reportBranch, childA, childB, grand1];
    const bankTree: FlatNode<CustomData>[] = [];

    const { nextBankTree, nextReportTree } = moveBranchToBank(reportTree, bankTree, 'br-1');

    it('all 4 nodes are absent from report after the move', () => {
      const ids = nextReportTree.map(n => n.id);
      expect(ids).not.toContain('br-1');
      expect(ids).not.toContain('child-A');
      expect(ids).not.toContain('child-B');
      expect(ids).not.toContain('grand-1');
    });

    it('all 4 nodes are present in bank after the move', () => {
      const ids = nextBankTree.map(n => n.id);
      expect(ids).toContain('br-1');
      expect(ids).toContain('child-A');
      expect(ids).toContain('child-B');
      expect(ids).toContain('grand-1');
    });

    it('the branch root parent is rewritten to "bank"', () => {
      const movedBranch = nextBankTree.find(n => n.id === 'br-1');
      expect(movedBranch!.parent).toBe('bank');
    });

    it('children retain their original parents', () => {
      expect(nextBankTree.find(n => n.id === 'child-A')!.parent).toBe('br-1');
      expect(nextBankTree.find(n => n.id === 'child-B')!.parent).toBe('br-1');
      expect(nextBankTree.find(n => n.id === 'grand-1')!.parent).toBe('child-A');
    });

    it('total node count (bank + report) is unchanged', () => {
      const before = reportTree.length + bankTree.length;
      const after = nextBankTree.length + nextReportTree.length;
      expect(after).toBe(before);
    });
  });

  describe('bank branch deletion', () => {
    const bankBranch = branch('bank-br', 'bank');
    const bankChild = branch('bank-child', 'bank-br');
    const bankGrand = leaf('bank-grand', 'bank-child');
    const unrelated = leaf('other', 'bank');

    const bankTree: FlatNode<CustomData>[] = [bankBranch, bankChild, bankGrand, unrelated];
    const reportTree: FlatNode<CustomData>[] = [leaf('r-1', 'report')];

    const { nextBankTree, nextReportTree } = moveBranchToBank(reportTree, bankTree, 'bank-br');

    it('branch and all descendants are removed from bank', () => {
      const ids = nextBankTree.map(n => n.id);
      expect(ids).not.toContain('bank-br');
      expect(ids).not.toContain('bank-child');
      expect(ids).not.toContain('bank-grand');
    });

    it('unrelated bank nodes are preserved', () => {
      expect(nextBankTree.find(n => n.id === 'other')).toBeDefined();
    });

    it('report tree is unchanged', () => {
      expect(nextReportTree).toEqual(reportTree);
    });
  });

  describe('leaf deletion', () => {
    const bankLeaf = leaf('bank-leaf', 'bank');
    const reportLeaf = leaf('report-leaf', 'report');
    const bankTree: FlatNode<CustomData>[] = [bankLeaf, leaf('other-bank', 'bank')];
    const reportTree: FlatNode<CustomData>[] = [reportLeaf, leaf('other-report', 'report')];

    it('removes a leaf from the bank tree, report unchanged', () => {
      const { nextBankTree, nextReportTree } = moveBranchToBank(reportTree, bankTree, 'bank-leaf');
      expect(nextBankTree.find(n => n.id === 'bank-leaf')).toBeUndefined();
      expect(nextBankTree.find(n => n.id === 'other-bank')).toBeDefined();
      expect(nextReportTree).toEqual(reportTree);
    });

    it('removes a leaf from the report tree, bank unchanged', () => {
      const { nextBankTree, nextReportTree } = moveBranchToBank(
        reportTree,
        bankTree,
        'report-leaf',
      );
      expect(nextReportTree.find(n => n.id === 'report-leaf')).toBeUndefined();
      expect(nextReportTree.find(n => n.id === 'other-report')).toBeDefined();
      expect(nextBankTree).toEqual(bankTree);
    });
  });
});
