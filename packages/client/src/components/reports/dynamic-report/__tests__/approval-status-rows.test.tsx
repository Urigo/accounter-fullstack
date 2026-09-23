import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountantStatus } from '../../../../gql/graphql.js';
import { TreePanel } from '../tree-panel.js';
import { buildApprovalStats, deriveLeafStatuses } from '../utils/approvals.js';
import type { ReportDiff } from '../utils/diff.js';
import type { CustomData, FlatNode } from '../utils/types.js';

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

function leaf(id: string, parent: string): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Entity ${id}`,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false, value: 10, fingerprint: `fp-${id}` },
  };
}

function branch(id: string, parent: string): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Branch ${id}`,
    droppable: true,
    data: { nodeType: 'synthetic-branch', isOpen: true },
  };
}

const noop = (): void => {};

function statusTriggers(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[data-accountant-status-trigger]')];
}

describe('report tree status slot', () => {
  it('shows a disabled status on report leaves and branches', () => {
    const nodes = [branch('b', 'report'), leaf('a', 'b')];
    const leafStatuses = deriveLeafStatuses(
      nodes,
      [
        {
          entityId: 'a',
          status: AccountantStatus.Approved,
          setAt: '2026-03-01T10:00:00.000Z',
          setBy: 'Dana',
          isSystem: false,
        },
      ],
      new Map([['a', 'fp-a']]),
    );
    const approvalStats = buildApprovalStats(nodes, id => leafStatuses.get(id)?.status);

    act(() =>
      root.render(
        <TreePanel
          treeId="report"
          title="Report"
          nodes={nodes}
          editMode={false}
          emptyMessage="empty"
          onAddBranch={noop}
          onToggleExpand={noop}
          leafStatuses={leafStatuses}
          approvalStats={approvalStats}
        />,
      ),
    );

    const triggers = statusTriggers();
    // branch + leaf
    expect(triggers).toHaveLength(2);
    expect(triggers.every(button => button.disabled)).toBe(true);
    expect(triggers.map(button => button.getAttribute('aria-label'))).toEqual([
      'Approved',
      'Approved',
    ]);
  });

  it('gives a branch with no counted leaves no status', () => {
    const nodes = [branch('empty', 'report')];
    act(() =>
      root.render(
        <TreePanel
          treeId="report"
          title="Report"
          nodes={nodes}
          editMode={false}
          emptyMessage="empty"
          onAddBranch={noop}
          onToggleExpand={noop}
          leafStatuses={new Map()}
          approvalStats={buildApprovalStats(nodes, () => undefined)}
        />,
      ),
    );
    expect(statusTriggers()).toHaveLength(0);
  });

  it('gives ghost rows no status', () => {
    const nodes = [leaf('a', 'report')];
    const ghost = leaf('gone', 'report');
    const diff: ReportDiff = {
      byNodeId: new Map([['gone', [{ kind: 'removed', previousValue: 10 }]]]),
      subtreeDelta: new Map(),
      ghosts: [ghost],
    };
    act(() =>
      root.render(
        <TreePanel
          treeId="report"
          title="Report"
          nodes={nodes}
          editMode={false}
          emptyMessage="empty"
          onAddBranch={noop}
          onToggleExpand={noop}
          diff={diff}
          leafStatuses={
            new Map([
              ['a', { status: AccountantStatus.Unapproved }],
              ['gone', { status: AccountantStatus.Unapproved }],
            ])
          }
          approvalStats={buildApprovalStats(nodes, () => undefined)}
        />,
      ),
    );
    expect(container.textContent).toContain('Entity gone');
    expect(statusTriggers()).toHaveLength(1);
  });

  it('shows no status on bank rows', () => {
    const nodes = [branch('b', 'bank'), leaf('a', 'b')];
    const leafStatuses = deriveLeafStatuses(nodes, null, new Map());
    act(() =>
      root.render(
        <TreePanel
          treeId="bank"
          title="Bank"
          nodes={nodes}
          editMode={false}
          emptyMessage="empty"
          onAddBranch={noop}
          onToggleExpand={noop}
          leafStatuses={leafStatuses}
          approvalStats={buildApprovalStats(nodes, id => leafStatuses.get(id)?.status)}
        />,
      ),
    );
    expect(container.textContent).toContain('Entity a');
    expect(statusTriggers()).toHaveLength(0);
  });
});
