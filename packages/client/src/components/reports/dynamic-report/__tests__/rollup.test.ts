import { describe, expect, it, vi } from 'vitest';
import { AccountantStatus } from '../../../../gql/graphql.js';
import { buildApprovalStats, type ApprovalCounts } from '../utils/approvals.js';
import { rollup } from '../utils/rollup.js';
import { buildNodeStats, type CustomData, type FlatNode } from '../utils/types.js';

function leaf(
  id: string,
  parent: string,
  value: number,
  extra: Partial<CustomData> = {},
): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Entity ${id}`,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false, value, ...extra },
  };
}

function branch(
  id: string,
  parent: string,
  nodeType: CustomData['nodeType'] = 'synthetic-branch',
): FlatNode<CustomData> {
  return { id, parent, text: `Branch ${id}`, droppable: true, data: { nodeType, isOpen: false } };
}

const sum = (nodes: FlatNode<CustomData>[]): Map<string, number> =>
  rollup(
    nodes,
    node => node.data.value ?? 0,
    (acc, child) => acc + child,
    () => 0,
  );

// report
// ├─ A
// │  ├─ a1  10
// │  └─ A1
// │     └─ a2  5
// ├─ E (empty)
// └─ r1  1
const tree = [
  branch('A', 'report'),
  leaf('a1', 'A', 10),
  branch('A1', 'A'),
  leaf('a2', 'A1', 5),
  branch('E', 'report'),
  leaf('r1', 'report', 1),
];

describe('rollup', () => {
  it('gives every leaf its own value and every branch the fold of its subtree', () => {
    expect(sum(tree)).toEqual(
      new Map([
        ['A', 15],
        ['a1', 10],
        ['A1', 5],
        ['a2', 5],
        ['E', 0],
        ['r1', 1],
      ]),
    );
  });

  it('gives an empty branch the empty value', () => {
    expect(sum([branch('E', 'report')]).get('E')).toBe(0);
  });

  it('returns an empty map for an empty tree', () => {
    expect(sum([])).toEqual(new Map());
  });

  it('gives a skipped leaf no entry and leaves it out of its ancestors', () => {
    const nodes = [branch('A', 'report'), leaf('a1', 'A', 10), leaf('a2', 'A', 5)];
    const result = rollup(
      nodes,
      node => (node.id === 'a2' ? null : (node.data.value ?? 0)),
      (acc, child) => acc + child,
      () => 0,
    );
    expect(result.has('a2')).toBe(false);
    expect(result.get('A')).toBe(10);
  });

  it('keeps an entry for a branch whose leaves are all skipped', () => {
    const nodes = [branch('A', 'report'), leaf('a1', 'A', 10)];
    const result = rollup(
      nodes,
      () => null,
      (acc: number, child: number) => acc + child,
      () => 0,
    );
    expect(result).toEqual(new Map([['A', 0]]));
  });

  it('folds children in array order, starting from a fresh empty value per branch', () => {
    const nodes = [branch('A', 'report'), leaf('x', 'A', 0), leaf('y', 'A', 0), leaf('z', 'A', 0)];
    const result = rollup<string[]>(
      nodes,
      node => [node.id],
      (acc, child) => {
        acc.push(...child);
        return acc;
      },
      () => [],
    );
    expect(result.get('A')).toEqual(['x', 'y', 'z']);
    // The leaves' values are untouched by the branch's in-place fold.
    expect(result.get('x')).toEqual(['x']);
  });

  it('passes the branch to empty, so a branch can seed the fold with its own contribution', () => {
    const nodes = [branch('A', 'report'), branch('A1', 'A'), leaf('a1', 'A1', 0)];
    const empty = vi.fn((b: FlatNode<CustomData>) => (b.id === 'A1' ? 100 : 0));
    const result = rollup(
      nodes,
      () => 1,
      (acc: number, child: number) => acc + child,
      empty,
    );
    expect(result.get('A1')).toBe(101);
    expect(result.get('A')).toBe(101);
    expect(empty.mock.calls.map(([b]) => b.id).sort()).toEqual(['A', 'A1']);
  });

  it('computes each node once, however many ancestors read it', () => {
    const leafFn = vi.fn((node: FlatNode<CustomData>) => node.data.value ?? 0);
    const deep = [
      branch('A', 'report'),
      branch('B', 'A'),
      branch('C', 'B'),
      leaf('c1', 'C', 1),
      leaf('c2', 'C', 2),
    ];
    const result = rollup(
      deep,
      leafFn,
      (acc: number, child: number) => acc + child,
      () => 0,
    );
    expect(result.get('A')).toBe(3);
    expect(leafFn).toHaveBeenCalledTimes(2);
  });

  it('calls leaf only for financial-entity nodes, whatever their droppable flag', () => {
    const leafFn = vi.fn((_node: FlatNode<CustomData>) => 1);
    rollup(
      [branch('S', 'report', 'sort-code-branch'), leaf('s1', 'S', 0)],
      leafFn,
      (acc: number, child: number) => acc + child,
      () => 0,
    );
    expect(leafFn.mock.calls.map(([node]) => node.id)).toEqual(['s1']);
  });

  it('ignores anything nested under a leaf', () => {
    const nodes = [leaf('a', 'report', 3), leaf('under', 'a', 100)];
    expect(sum(nodes).get('a')).toBe(3);
  });

  it('still rolls up a subtree whose parent is not in the tree', () => {
    const nodes = [branch('orphan', 'missing'), leaf('o1', 'orphan', 7)];
    expect(sum(nodes).get('orphan')).toBe(7);
  });

  it('folds an id listed twice under one parent twice, as the tree renders it', () => {
    const nodes = [branch('A', 'report'), leaf('a1', 'A', 10), leaf('a1', 'A', 10)];
    expect(sum(nodes).get('A')).toBe(20);
  });
});

// ── Equivalence with the hand-written walks rollup replaced ──────────────────────
// Verbatim copies of buildNodeStats and buildApprovalStats as they were before they moved onto
// rollup, used as oracles over generated trees.

function legacyBuildNodeStats(nodes: FlatNode<CustomData>[]) {
  const nodeById = new Map<string, FlatNode<CustomData>>();
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    nodeById.set(n.id, n);
    if (!childrenOf.has(n.parent)) childrenOf.set(n.parent, []);
    childrenOf.get(n.parent)!.push(n.id);
  }
  const result = new Map<string, { sum: number; leafCount: number }>();
  function visit(nodeId: string): { sum: number; leafCount: number } {
    const cached = result.get(nodeId);
    if (cached) return cached;
    const node = nodeById.get(nodeId);
    if (!node) return { sum: 0, leafCount: 0 };
    if (node.data.nodeType === 'financial-entity') {
      const stats = { sum: node.data.value ?? 0, leafCount: 1 };
      result.set(nodeId, stats);
      return stats;
    }
    let s = 0;
    let leafCount = 0;
    for (const childId of childrenOf.get(nodeId) ?? []) {
      const childStats = visit(childId);
      s += childStats.sum;
      leafCount += childStats.leafCount;
    }
    const stats = { sum: s, leafCount };
    result.set(nodeId, stats);
    return stats;
  }
  for (const n of nodes) visit(n.id);
  return result;
}

function legacyBuildApprovalStats(
  nodes: FlatNode<CustomData>[],
  statusOf: (entityId: string) => AccountantStatus | undefined,
) {
  const nodeById = new Map<string, FlatNode<CustomData>>();
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    nodeById.set(n.id, n);
    const siblings = childrenOf.get(n.parent);
    if (siblings) siblings.push(n.id);
    else childrenOf.set(n.parent, [n.id]);
  }
  const result = new Map<string, ApprovalCounts>();
  const empty: ApprovalCounts = { approved: 0, pending: 0, unapproved: 0 };
  function visit(nodeId: string): ApprovalCounts {
    const cached = result.get(nodeId);
    if (cached) return cached;
    const node = nodeById.get(nodeId);
    if (!node) return empty;
    if (node.data.nodeType === 'financial-entity') {
      if (node.data.isHidden) return empty;
      const status = statusOf(node.id) ?? AccountantStatus.Unapproved;
      const counts: ApprovalCounts = {
        approved: status === AccountantStatus.Approved ? 1 : 0,
        pending: status === AccountantStatus.Pending ? 1 : 0,
        unapproved: status === AccountantStatus.Unapproved ? 1 : 0,
      };
      result.set(nodeId, counts);
      return counts;
    }
    const counts: ApprovalCounts = { approved: 0, pending: 0, unapproved: 0 };
    for (const childId of childrenOf.get(nodeId) ?? []) {
      const child = visit(childId);
      counts.approved += child.approved;
      counts.pending += child.pending;
      counts.unapproved += child.unapproved;
    }
    result.set(nodeId, counts);
    return counts;
  }
  for (const n of nodes) visit(n.id);
  return result;
}

/** A small deterministic PRNG, so a failure reproduces from its seed. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * A random forest with the awkward cases the walks have to agree on: hidden leaves, leaves without
 * a value, empty branches, sort-code branches, orphans and ids repeated under one parent.
 */
function randomTree(seed: number): FlatNode<CustomData>[] {
  const random = mulberry32(seed);
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
  const branchIds = ['report'];
  const nodes: FlatNode<CustomData>[] = [];
  const size = 1 + Math.floor(random() * 30);
  for (let i = 0; i < size; i++) {
    const parent = random() < 0.05 ? 'missing' : pick(branchIds);
    const roll = random();
    if (roll < 0.3) {
      const id = `b${i}`;
      nodes.push(branch(id, parent, random() < 0.5 ? 'sort-code-branch' : 'synthetic-branch'));
      branchIds.push(id);
    } else if (roll < 0.35 && nodes.some(node => !node.droppable)) {
      // Only leaves are repeated: a repeated branch could land under itself, which no walk survives.
      nodes.push({ ...pick(nodes.filter(node => !node.droppable)), parent });
    } else {
      const value = random() < 0.1 ? null : Math.round((random() - 0.5) * 1000);
      nodes.push(leaf(`l${i}`, parent, 0, { value, isHidden: random() < 0.2 }));
    }
  }
  return nodes;
}

const STATUSES = [AccountantStatus.Approved, AccountantStatus.Pending, AccountantStatus.Unapproved];

describe('buildNodeStats and buildApprovalStats on rollup', () => {
  it('match the walks they replaced on generated trees', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const nodes = randomTree(seed);
      expect(buildNodeStats(nodes), `seed ${seed}`).toEqual(legacyBuildNodeStats(nodes));

      const random = mulberry32(seed * 7);
      const statuses = new Map(
        nodes.map(
          node =>
            [node.id, random() < 0.2 ? undefined : STATUSES[Math.floor(random() * 3)]] as const,
        ),
      );
      const statusOf = (id: string) => statuses.get(id);
      expect(buildApprovalStats(nodes, statusOf), `seed ${seed}`).toEqual(
        legacyBuildApprovalStats(nodes, statusOf),
      );
    }
  });

  it('counts hidden leaves in node stats but not in approval stats', () => {
    const nodes = [
      branch('A', 'report'),
      leaf('a1', 'A', 10),
      leaf('h', 'A', 0, { isHidden: true }),
    ];
    expect(buildNodeStats(nodes).get('A')).toEqual({ sum: 10, leafCount: 2 });
    const approvals = buildApprovalStats(nodes, () => AccountantStatus.Approved);
    expect(approvals.get('A')).toEqual({ approved: 1, pending: 0, unapproved: 0 });
    expect(approvals.has('h')).toBe(false);
  });

  it('counts a leaf with no known status as unapproved', () => {
    const nodes = [branch('A', 'report'), leaf('a1', 'A', 10)];
    expect(buildApprovalStats(nodes, () => undefined).get('A')).toEqual({
      approved: 0,
      pending: 0,
      unapproved: 1,
    });
  });
});
