import { describe, expect, it } from 'vitest';
import { handleCrossTreeDrop } from '../utils/cross-tree-drop.js';
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
