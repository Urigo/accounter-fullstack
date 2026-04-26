export type NodeType = 'sort-code-branch' | 'synthetic-branch' | 'financial-entity';

export type CustomData = {
  nodeType: NodeType;
  hebrewText?: string;
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
  const childrenMap = new Map<string, string[]>();
  for (const node of nodes) {
    const children = childrenMap.get(node.parent) ?? [];
    children.push(node.id);
    childrenMap.set(node.parent, children);
  }

  const result: string[] = [];
  const queue = [rootId];
  while (queue.length) {
    const id = queue.pop()!;
    const children = childrenMap.get(id) ?? [];
    for (const childId of children) {
      result.push(childId);
      queue.push(childId);
    }
  }
  return result;
}

export type NodeStats = Map<string, { sum: number; leafCount: number }>;

/**
 * Pre-computes sum and leaf-count for every branch node in O(N) using a
 * bottom-up post-order DFS, so callers don't have to recurse per-node.
 */
export function buildNodeStats(nodes: FlatNode<CustomData>[]): NodeStats {
  const nodeById = new Map<string, FlatNode<CustomData>>();
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    nodeById.set(n.id, n);
    if (!childrenOf.has(n.parent)) childrenOf.set(n.parent, []);
    childrenOf.get(n.parent)!.push(n.id);
  }

  const result: NodeStats = new Map();

  function visit(nodeId: string): { sum: number; leafCount: number } {
    const cached = result.get(nodeId);
    if (cached) return cached;

    const node = nodeById.get(nodeId);
    if (!node) return { sum: 0, leafCount: 0 };

    if (isFinancialEntityNode(node)) {
      const stats = { sum: node.data.value ?? 0, leafCount: 1 };
      result.set(nodeId, stats);
      return stats;
    }

    let sum = 0;
    let leafCount = 0;
    for (const childId of childrenOf.get(nodeId) ?? []) {
      const childStats = visit(childId);
      sum += childStats.sum;
      leafCount += childStats.leafCount;
    }
    const stats = { sum, leafCount };
    result.set(nodeId, stats);
    return stats;
  }

  for (const n of nodes) {
    visit(n.id);
  }

  return result;
}
const currencyFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}
