import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountantStatus } from '../../../../gql/graphql.js';
import { TreePanel } from '../tree-panel.js';
import {
  buildApprovalStats,
  needsReviewVisibility,
  type EffectiveApproval,
} from '../utils/approvals.js';
import type { ReportDiff } from '../utils/diff.js';
import { serializeReportTree } from '../utils/template-serialization.js';
import { formatCurrency, type CustomData, type FlatNode } from '../utils/types.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

function leaf(id: string, parent: string, value: number): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Entity ${id}`,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false, value, fingerprint: `fp-${id}` },
  };
}

function branch(id: string, parent: string, isOpen: boolean): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Branch ${id}`,
    droppable: true,
    data: { nodeType: 'synthetic-branch', isOpen },
  };
}

const noop = (): void => {};

// report
// ├─ A (closed in the template)
// │  ├─ a1 approved  1234
// │  └─ a2 pending    567
// └─ B (open, fully approved)
//    └─ b1 approved    10
const nodes = [
  branch('A', 'report', false),
  leaf('a1', 'A', 1234),
  leaf('a2', 'A', 567),
  branch('B', 'report', true),
  leaf('b1', 'B', 10),
];

const statuses = new Map<string, EffectiveApproval>([
  ['a1', { status: AccountantStatus.Approved }],
  ['a2', { status: AccountantStatus.Pending }],
  ['b1', { status: AccountantStatus.Approved }],
]);

function renderReport({
  tree = nodes,
  reviewOnly,
  diff = null,
  onToggleExpand = noop,
}: {
  tree?: FlatNode<CustomData>[];
  reviewOnly: boolean;
  diff?: ReportDiff | null;
  onToggleExpand?: (nodeId: string) => void;
}): void {
  const statusOf = (id: string) => statuses.get(id)?.status;
  act(() =>
    root.render(
      <TreePanel
        treeId="report"
        title="Report"
        nodes={tree}
        editMode={false}
        emptyMessage="empty"
        onAddBranch={noop}
        onToggleExpand={onToggleExpand}
        diff={diff}
        leafStatuses={statuses}
        approvalStats={buildApprovalStats(tree, statusOf)}
        reviewVisibility={reviewOnly ? needsReviewVisibility(tree, statusOf) : null}
      />,
    ),
  );
}

function text(): string {
  return container.textContent ?? '';
}

describe('Needs review filter', () => {
  it('shows every row the template has open when the filter is off', () => {
    renderReport({ reviewOnly: false });
    expect(text()).toContain('Branch A');
    expect(text()).not.toContain('Entity a2'); // A is closed
    expect(text()).toContain('Entity b1');
  });

  it('shows only non-approved leaves and their ancestors, force-expanded', () => {
    renderReport({ reviewOnly: true });
    expect(text()).toContain('Branch A');
    expect(text()).toContain('Entity a2');
    expect(text()).not.toContain('Entity a1');
    expect(text()).not.toContain('Branch B');
    expect(text()).not.toContain('Entity b1');
  });

  it('keeps branch sums unfiltered', () => {
    renderReport({ reviewOnly: true });
    expect(text()).toContain(formatCurrency(1234 + 567));
  });

  it('never changes the serialized template, including isOpen', () => {
    const before = serializeReportTree(nodes);
    renderReport({ reviewOnly: false });
    renderReport({ reviewOnly: true });
    renderReport({ reviewOnly: false });
    expect(serializeReportTree(nodes)).toBe(before);
    expect(nodes.find(n => n.id === 'A')?.data.isOpen).toBe(false);
  });

  it("doesn't toggle a force-expanded branch's saved isOpen", () => {
    const onToggleExpand = vi.fn();
    renderReport({ reviewOnly: true, onToggleExpand });
    const toggle = container.querySelector<HTMLButtonElement>('[data-expand-toggle="A"]');
    expect(toggle).not.toBeNull();
    expect(toggle!.disabled).toBe(true);
    act(() => toggle!.click());
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it('shows a message when nothing needs review', () => {
    const approvedOnly = [branch('B', 'report', true), leaf('b1', 'B', 10)];
    renderReport({ tree: approvedOnly, reviewOnly: true });
    expect(text()).not.toContain('Branch B');
    expect(text()).toContain('Nothing needs review');
  });

  it('keeps ghost rows only under a visible ancestor', () => {
    const nestedGhost = leaf('gone-a', 'A', 5);
    const rootGhost = leaf('gone-root', 'report', 5);
    const diff: ReportDiff = {
      byNodeId: new Map([
        ['gone-a', [{ kind: 'removed', previousValue: 5 }]],
        ['gone-root', [{ kind: 'removed', previousValue: 5 }]],
      ]),
      subtreeDelta: new Map(),
      ghosts: [nestedGhost, rootGhost],
    };
    renderReport({ reviewOnly: true, diff });
    expect(text()).toContain('Entity gone-a');
    expect(text()).not.toContain('Entity gone-root');

    renderReport({ reviewOnly: false, diff });
    expect(text()).toContain('Entity gone-root');
  });
});
