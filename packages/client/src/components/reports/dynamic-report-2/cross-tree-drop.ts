import type { Instruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import {
  getDescendantIds,
  isFinancialEntityNode,
  type CustomData,
  type FlatNode,
} from './types.js';

export type DragPayload = {
  nodeId: string;
  sourceTreeId: 'bank' | 'report';
};

/**
 * Applies a Pragmatic DnD tree-item Instruction to the flat node arrays.
 *
 * @param bankTree       Current bank flat nodes
 * @param reportTree     Current report flat nodes
 * @param payload        Drag payload attached to the draggable element
 * @param targetNodeId   Id of the node the item was dropped on (or tree root id)
 * @param targetTreeId   Which panel received the drop ('bank' | 'report')
 * @param instruction    Tree-item hitbox instruction — or null for root-level drops
 *
 * @returns { nextBankTree, nextReportTree }
 */
export function handleCrossTreeDrop(
  bankTree: FlatNode<CustomData>[],
  reportTree: FlatNode<CustomData>[],
  payload: DragPayload,
  targetNodeId: string,
  targetTreeId: 'bank' | 'report',
  instruction: Instruction | null,
): { nextBankTree: FlatNode<CustomData>[]; nextReportTree: FlatNode<CustomData>[] } {
  const sourceTree = payload.sourceTreeId === 'bank' ? bankTree : reportTree;
  const targetTree = targetTreeId === 'bank' ? bankTree : reportTree;

  // Guard: dragging onto self
  if (targetNodeId === payload.nodeId) {
    return { nextBankTree: bankTree, nextReportTree: reportTree };
  }

  const draggedNode = sourceTree.find(n => n.id === payload.nodeId);
  if (!draggedNode) return { nextBankTree: bankTree, nextReportTree: reportTree };

  // canDrop guard: cannot make a financial-entity a child
  if (instruction?.type === 'make-child') {
    const targetNode = targetTree.find(n => n.id === targetNodeId);
    if (targetNode && isFinancialEntityNode(targetNode)) {
      return { nextBankTree: bankTree, nextReportTree: reportTree };
    }
  }

  // Collect all ids to move (dragged node + all descendants)
  const movedIds = new Set([payload.nodeId, ...getDescendantIds(sourceTree, payload.nodeId)]);
  const movedNodes = sourceTree.filter(n => movedIds.has(n.id));

  const isSameTree = payload.sourceTreeId === targetTreeId;
  // After removing moved nodes from the source, what remains
  const prunedSourceTree = sourceTree.filter(n => !movedIds.has(n.id));
  // The base for building the target (deduped: if same tree, use pruned)
  const baseTarget = isSameTree ? prunedSourceTree : targetTree;

  let nextTargetTree: FlatNode<CustomData>[];

  if (!instruction || instruction.type === 'instruction-blocked') {
    // Append at root level of the target tree
    const updatedMoved = movedNodes.map(n =>
      n.id === payload.nodeId ? { ...n, parent: targetTreeId } : n,
    );
    nextTargetTree = [...baseTarget, ...updatedMoved];
  } else if (instruction.type === 'make-child') {
    const updatedMoved = movedNodes.map(n =>
      n.id === payload.nodeId ? { ...n, parent: targetNodeId } : n,
    );
    nextTargetTree = [...baseTarget, ...updatedMoved];
  } else if (instruction.type === 'reorder-above') {
    const targetNode = baseTarget.find(n => n.id === targetNodeId);
    const newParent = targetNode?.parent ?? targetTreeId;
    const updatedMoved = movedNodes.map(n =>
      n.id === payload.nodeId ? { ...n, parent: newParent } : n,
    );
    const targetIndex = baseTarget.findIndex(n => n.id === targetNodeId);
    if (targetIndex === -1) {
      nextTargetTree = [...baseTarget, ...updatedMoved];
    } else {
      nextTargetTree = [
        ...baseTarget.slice(0, targetIndex),
        ...updatedMoved,
        ...baseTarget.slice(targetIndex),
      ];
    }
  } else if (instruction.type === 'reorder-below') {
    const targetNode = baseTarget.find(n => n.id === targetNodeId);
    const newParent = targetNode?.parent ?? targetTreeId;
    const updatedMoved = movedNodes.map(n =>
      n.id === payload.nodeId ? { ...n, parent: newParent } : n,
    );
    const targetIndex = baseTarget.findIndex(n => n.id === targetNodeId);
    if (targetIndex === -1) {
      nextTargetTree = [...baseTarget, ...updatedMoved];
    } else {
      nextTargetTree = [
        ...baseTarget.slice(0, targetIndex + 1),
        ...updatedMoved,
        ...baseTarget.slice(targetIndex + 1),
      ];
    }
  } else if (instruction.type === 'reparent') {
    // Walk up from targetNodeId by (currentLevel - desiredLevel) steps to find the new parent
    const levelsUp = instruction.currentLevel - instruction.desiredLevel;
    let ancestorId: string = targetNodeId;
    for (let i = 0; i < levelsUp; i++) {
      const ancestor = baseTarget.find(n => n.id === ancestorId);
      if (!ancestor) break;
      ancestorId = ancestor.parent;
    }
    const updatedMoved = movedNodes.map(n =>
      n.id === payload.nodeId ? { ...n, parent: ancestorId } : n,
    );
    const targetIndex = baseTarget.findIndex(n => n.id === targetNodeId);
    nextTargetTree = [
      ...baseTarget.slice(0, targetIndex + 1),
      ...updatedMoved,
      ...baseTarget.slice(targetIndex + 1),
    ];
  } else {
    nextTargetTree = [...baseTarget, ...movedNodes];
  }

  if (isSameTree) {
    if (targetTreeId === 'bank') {
      return { nextBankTree: nextTargetTree, nextReportTree: reportTree };
    }
    return { nextBankTree: bankTree, nextReportTree: nextTargetTree };
  }

  if (payload.sourceTreeId === 'bank') {
    return { nextBankTree: prunedSourceTree, nextReportTree: nextTargetTree };
  }
  return { nextBankTree: nextTargetTree, nextReportTree: prunedSourceTree };
}
