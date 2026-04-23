import { getDescendantIds, type CustomData, type FlatNode } from './types.js';

/**
 * Pure function that implements the delete-node logic:
 *
 * - Report branch  → move the full subtree to the bank tree (root parent = 'bank').
 * - Bank branch    → permanently remove the full subtree.
 * - Leaf           → remove that single node from whichever tree contains it.
 *
 * All internal parent links are preserved; only the root of the moved subtree
 * has its parent rewritten to 'bank'.
 */
export function moveBranchToBank(
  reportTree: FlatNode<CustomData>[],
  bankTree: FlatNode<CustomData>[],
  nodeId: string,
): { nextBankTree: FlatNode<CustomData>[]; nextReportTree: FlatNode<CustomData>[] } {
  const nodeInBank = bankTree.find(n => n.id === nodeId);
  const node = nodeInBank || reportTree.find(n => n.id === nodeId);

  if (!node) {
    return { nextBankTree: bankTree, nextReportTree: reportTree };
  }

  const isInBank = !!nodeInBank;

  if (!node.droppable) {
    // Leaf — remove from whichever tree holds it
    return {
      nextBankTree: isInBank ? bankTree.filter(n => n.id !== nodeId) : bankTree,
      nextReportTree: isInBank ? reportTree : reportTree.filter(n => n.id !== nodeId),
    };
  }

  const sourceTree = isInBank ? bankTree : reportTree;
  const subtreeIds = new Set([nodeId, ...getDescendantIds(sourceTree, nodeId)]);

  if (isInBank) {
    // Bank branch — permanently delete the whole subtree
    return {
      nextBankTree: bankTree.filter(n => !subtreeIds.has(n.id)),
      nextReportTree: reportTree,
    };
  }

  // Report branch — move full subtree to bank, rerooting the branch node
  const nextReportTree: FlatNode<CustomData>[] = [];
  const subtreeNodes: FlatNode<CustomData>[] = [];
  for (const n of reportTree) {
    if (subtreeIds.has(n.id)) {
      subtreeNodes.push(n.id === nodeId ? { ...n, parent: 'bank' } : n);
    } else {
      nextReportTree.push(n);
    }
  }

  return {
    nextBankTree: [...bankTree, ...subtreeNodes],
    nextReportTree,
  };
}
