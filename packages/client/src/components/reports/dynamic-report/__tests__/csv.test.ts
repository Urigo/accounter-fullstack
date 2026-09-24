import { describe, expect, it } from 'vitest';
import { AccountantStatus } from '../../../../gql/graphql.js';
import { buildReportCsv } from '../utils/csv.js';
import { buildNodeStats, type CustomData, type FlatNode } from '../utils/types.js';

function leaf(
  id: string,
  parent: string,
  overrides: Partial<CustomData> = {},
  text = id,
): FlatNode<CustomData> {
  return {
    id,
    parent,
    text,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false, value: 100, ...overrides },
  };
}

function branch(id: string, parent: string, text = id): FlatNode<CustomData> {
  return { id, parent, text, droppable: true, data: { nodeType: 'synthetic-branch', isOpen: true } };
}

/** The CSV export as it was before the Status column, kept to prove the extraction is lossless. */
function legacyCsv(reportTree: FlatNode<CustomData>[]): string {
  const nodeStats = buildNodeStats(reportTree);
  const rows: string[] = ['Name,Value (ILS),Depth'];
  const escapeCsv = (text: string) => `"${text.replaceAll('"', '""')}"`;
  const childrenMap = new Map<string, typeof reportTree>();
  for (const node of reportTree) {
    const list = childrenMap.get(node.parent) || [];
    list.push(node);
    childrenMap.set(node.parent, list);
  }
  function traverse(parentId: string, depth: number) {
    const children = childrenMap.get(parentId) ?? [];
    for (const node of children) {
      if (node.data.isHidden) continue;
      if (node.droppable) {
        const sum = nodeStats.get(node.id)?.sum ?? 0;
        rows.push(`${escapeCsv(node.text)},${sum},${depth}`);
        traverse(node.id, depth + 1);
      } else {
        const value = node.data.value ?? 0;
        rows.push(`${escapeCsv(node.text)},${value},${depth}`);
      }
    }
  }
  traverse('report', 0);
  return rows.join('\n');
}

const tree: FlatNode<CustomData>[] = [
  branch('income', 'report', 'Income "gross"'),
  leaf('a', 'income', { value: 250.5 }, 'Acme, Ltd'),
  leaf('b', 'income', { value: -40 }),
  leaf('hidden', 'income', { value: 0, isHidden: true }),
  branch('costs', 'report'),
  branch('empty', 'costs'),
  leaf('c', 'costs', { value: null }),
  leaf('bank-only', 'bank', { value: 7 }),
];

const leafStatuses = new Map<string, AccountantStatus>([
  ['a', AccountantStatus.Approved],
  ['b', AccountantStatus.Pending],
  ['c', AccountantStatus.Unapproved],
  ['hidden', AccountantStatus.Approved],
]);
const branchStatuses = new Map<string, AccountantStatus | null>([
  ['income', AccountantStatus.Pending],
  ['costs', AccountantStatus.Unapproved],
  ['empty', null],
]);

function build(nodes = tree) {
  return buildReportCsv(
    nodes,
    buildNodeStats(nodes),
    id => leafStatuses.get(id),
    id => branchStatuses.get(id) ?? null,
  );
}

describe('buildReportCsv', () => {
  it('writes the header with a Status column', () => {
    expect(build().split('\n')[0]).toBe('Name,Value (ILS),Depth,Status');
  });

  it("gives a leaf its effective status and a branch its derived status, empty when there's none", () => {
    expect(build().split('\n')).toEqual([
      'Name,Value (ILS),Depth,Status',
      '"Income ""gross""",210.5,0,PENDING',
      '"Acme, Ltd",250.5,1,APPROVED',
      '"b",-40,1,PENDING',
      '"costs",0,0,UNAPPROVED',
      '"empty",0,1,',
      '"c",0,1,UNAPPROVED',
    ]);
  });

  it('leaves the status empty for a leaf without one', () => {
    const nodes = [leaf('x', 'report', { value: 3 })];
    expect(build(nodes).split('\n')[1]).toBe('"x",3,0,');
  });

  it('skips hidden leaves and nodes outside the report tree', () => {
    const csv = build();
    expect(csv).not.toContain('hidden');
    expect(csv).not.toContain('bank-only');
  });

  it('matches the previous export apart from the new column', () => {
    const withoutStatus = build()
      .split('\n')
      .map(row => row.slice(0, row.lastIndexOf(',')))
      .join('\n');
    expect(withoutStatus).toBe(legacyCsv(tree));
  });
});
