export type NodeType = 'sort-code-branch' | 'synthetic-branch' | 'financial-entity';

export type CustomData = {
  nodeType: NodeType;
  value?: number | null;
  sortCode?: number | null;
  isOpen: boolean;
  entityType?: 'business' | 'person';
};

export type FlatNode<T = CustomData> = {
  id: string;
  /** Parent node id, or the tree root id ('bank' | 'report') for top-level nodes. */
  parent: string;
  text: string;
  droppable: boolean;
  data: T;
};

export interface LedgerRecord {
  id: string;
  business: string;
  date: string;
  localAmount: number;
  localAmountBalance: number;
  reference: string;
  details: string;
  counterAccount: string;
}

export interface Template {
  id: string;
  name: string;
  lastUpdated: Date;
  isLocked: boolean;
  isLegacy?: boolean;
}

export interface Owner {
  id: string;
  name: string;
}

export function isFinancialEntityNode(node: FlatNode<CustomData>): boolean {
  return node.data.nodeType === 'financial-entity';
}

export function isSortCodeBranchNode(node: FlatNode<CustomData>): boolean {
  return node.data.nodeType === 'sort-code-branch';
}

export function isSyntheticBranchNode(node: FlatNode<CustomData>): boolean {
  return node.data.nodeType === 'synthetic-branch';
}

export function isBranchNode(node: FlatNode<CustomData>): boolean {
  return node.droppable === true;
}

/** Returns the ids of all descendants of rootId in a flat node array. */
export function getDescendantIds(nodes: FlatNode[], rootId: string): string[] {
  const result: string[] = [];
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const n of nodes) {
      if (n.parent === id) {
        result.push(n.id);
        queue.push(n.id);
      }
    }
  }
  return result;
}

export function calculateBranchSum(nodes: FlatNode<CustomData>[], branchId: string): number {
  let sum = 0;
  for (const n of nodes) {
    if (n.parent === branchId) {
      if (isFinancialEntityNode(n)) {
        sum += n.data.value ?? 0;
      } else if (isBranchNode(n)) {
        sum += calculateBranchSum(nodes, n.id);
      }
    }
  }
  return sum;
}

export function countLeaves(nodes: FlatNode<CustomData>[], branchId: string): number {
  let count = 0;
  for (const n of nodes) {
    if (n.parent === branchId) {
      if (isFinancialEntityNode(n)) {
        count += 1;
      } else if (isBranchNode(n)) {
        count += countLeaves(nodes, n.id);
      }
    }
  }
  return count;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
