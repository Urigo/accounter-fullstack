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
 * The nodes of a subtree moving into `target`, minus any branch `target` already holds under the
 * same id.
 *
 * A sort-code branch keeps its sort code's id in either tree, and the bank is rebuilt with every
 * entity not yet placed, so a sort-code branch can sit in the report while the bank holds another
 * one under the same id (listing the sort code's other entities). Moving one onto the other would
 * leave two nodes sharing an id. Instead the incoming branch merges into the one already there: its
 * own node is dropped, and its children, which point at that id, join the existing branch. The
 * existing branch keeps its place, name and open state, and no entity is lost.
 */
export function withoutCollidingBranches(
  target: FlatNode<CustomData>[],
  incoming: FlatNode<CustomData>[],
): FlatNode<CustomData>[] {
  const targetIds = new Set(target.map(n => n.id));
  return incoming.filter(n => !(n.droppable && targetIds.has(n.id)));
}

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
  if (
    targetNodeId === payload.nodeId ||
    (payload.sourceTreeId === targetTreeId &&
      getDescendantIds(sourceTree, payload.nodeId).includes(targetNodeId))
  ) {
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

  const isSameTree = payload.sourceTreeId === targetTreeId;

  // Collect all ids to move (dragged node + all descendants)
  const movedIds = new Set([payload.nodeId, ...getDescendantIds(sourceTree, payload.nodeId)]);
  const subtreeNodes = sourceTree.filter(n => movedIds.has(n.id));
  // Across trees, a branch the target already has merges into it rather than being duplicated.
  const movedNodes = isSameTree ? subtreeNodes : withoutCollidingBranches(targetTree, subtreeNodes);

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
    // Walk up from targetNodeId by (currentLevel - desiredLevel) steps to find the new parent.
    // Stop early if we reach a root sentinel or the node is not found, to prevent over-walking.
    const ROOT_SENTINELS = new Set(['bank', 'report']);
    const levelsUp = instruction.currentLevel - instruction.desiredLevel;
    let ancestorId: string = targetNodeId;
    for (let i = 0; i < levelsUp; i++) {
      if (ROOT_SENTINELS.has(ancestorId)) break;
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
