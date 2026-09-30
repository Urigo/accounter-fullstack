import { act, useCallback, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Client, Provider, type Exchange, type OperationResult } from 'urql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { map, pipe } from 'wonka';
import { useCommentsLayer, type CommentsLayer } from '../hooks/use-comments-layer.js';
import { TreePanel } from '../tree-panel.js';
import type { CustomData, FlatNode } from '../utils/types.js';
import type { RowVisibility } from '../utils/visibility.js';

vi.mock('sonner', () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

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

const noop = (): void => {};

function leaf(id: string, parent: string): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Entity ${id}`,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false, value: 1 },
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

// report
// ├─ A
// │  └─ A1
// │     └─ a1 (has a thread)
// └─ B
//    └─ b1
function tree(open: { A?: boolean; A1?: boolean; B?: boolean } = {}): FlatNode<CustomData>[] {
  return [
    branch('A', 'report', open.A ?? false),
    branch('A1', 'A', open.A1 ?? false),
    leaf('a1', 'A1'),
    branch('B', 'report', open.B ?? false),
    leaf('b1', 'B'),
  ];
}

const THREAD = {
  id: 't-a1',
  nodeId: 'a1',
  nodeKind: 'LEAF',
  nodeLabel: 'Entity a1',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  resolvedAt: null,
  resolvedBy: null,
  messages: [],
};

function mockClient(): Client {
  const exchange: Exchange = () => operations$ =>
    pipe(
      operations$,
      map((operation): OperationResult => ({
        operation,
        data: { dynamicReportThreads: [THREAD] },
        error: undefined,
        extensions: undefined,
        hasNext: false,
        stale: false,
      })),
    );
  return new Client({ url: '/graphql', exchanges: [exchange] });
}

type Probe = { layer: CommentsLayer; tree: FlatNode<CustomData>[] };

/** The report panel wired to the comments layer exactly as DynamicReport wires them. */
function renderReport(
  initialTree: FlatNode<CustomData>[],
  review: RowVisibility | null = null,
): { current: Probe } {
  const probe = {} as { current: Probe };
  function Harness(): ReactElement {
    const [nodes, setNodes] = useState(initialTree);
    const layer = useCommentsLayer({
      templateName: 'T',
      reportTree: nodes,
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      scopeOwnerId: 'owner-1',
      reviewVisibility: review,
    });
    probe.current = { layer, tree: nodes };
    const toggle = useCallback(
      (nodeId: string) =>
        setNodes(prev =>
          prev.map(n =>
            n.id === nodeId ? { ...n, data: { ...n.data, isOpen: !n.data.isOpen } } : n,
          ),
        ),
      [],
    );
    return (
      <TreePanel
        treeId="report"
        title="Report"
        nodes={nodes}
        editMode={false}
        emptyMessage="empty"
        onAddBranch={noop}
        onToggleExpand={nodeId => layer.toggleExpand(nodeId, toggle)}
        rowComments={layer.rowComments}
        reviewVisibility={layer.visibility}
        lockedOpenIds={layer.lockedOpenIds}
      />
    );
  }
  act(() =>
    root.render(
      <Provider value={mockClient()}>
        <Harness />
      </Provider>,
    ),
  );
  return probe;
}

const toggleOf = (id: string): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>(`[data-expand-toggle="${id}"]`)!;
const rendered = (id: string): boolean => !!container.querySelector(`[data-node-id="${id}"]`);
const savedOpen = (probe: { current: Probe }, id: string): boolean | undefined =>
  probe.current.tree.find(node => node.id === id)?.data.isOpen;

describe('collapsing a branch the reveal opened', () => {
  it('keeps the toggle working, and a click on a closed branch just ends the reveal', () => {
    const probe = renderReport(tree());
    act(() => probe.current.layer.selectThread('a1'));
    expect(rendered('a1')).toBe(true);
    expect(toggleOf('A').disabled).toBe(false);
    expect(toggleOf('A1').disabled).toBe(false);
    expect(toggleOf('A1').title).toBe('');

    act(() => toggleOf('A1').click());
    expect(probe.current.layer.revealNodeId).toBeNull();
    expect(probe.current.layer.visibility).toBeNull();
    // Every branch the reveal held open is back to its saved (closed) state, none of them written.
    expect(savedOpen(probe, 'A')).toBe(false);
    expect(savedOpen(probe, 'A1')).toBe(false);
    expect(rendered('A1')).toBe(false);
    expect(rendered('a1')).toBe(false);
  });

  it('also closes a clicked branch whose saved state is open, and writes no other ancestor', () => {
    const probe = renderReport(tree({ A: true }));
    act(() => probe.current.layer.selectThread('a1'));
    expect(probe.current.layer.visibility?.forceOpenIds).toEqual(new Set(['A1', 'A']));
    expect(toggleOf('A').disabled).toBe(false);

    act(() => toggleOf('A').click());
    expect(probe.current.layer.revealNodeId).toBeNull();
    expect(savedOpen(probe, 'A')).toBe(false);
    expect(savedOpen(probe, 'A1')).toBe(false);
    expect(rendered('A')).toBe(true);
    expect(rendered('A1')).toBe(false);
  });

  it('leaves the toggle of a branch the reveal doesn’t hold open alone', () => {
    const probe = renderReport(tree({ B: true }));
    act(() => probe.current.layer.selectThread('a1'));
    act(() => toggleOf('B').click());
    expect(savedOpen(probe, 'B')).toBe(false);
    // An unrelated toggle doesn't end the reveal.
    expect(probe.current.layer.revealNodeId).toBe('a1');
    expect(rendered('a1')).toBe(true);
  });
});

describe('branches Needs review forces open', () => {
  // Needs review showing b1, so B is forced open.
  const reviewB: RowVisibility = { visibleIds: new Set(['B', 'b1']), forceOpenIds: new Set(['B']) };

  it('keep a disabled toggle and its title', () => {
    const probe = renderReport(tree(), reviewB);
    expect(toggleOf('B').disabled).toBe(true);
    expect(toggleOf('B').title).toBe('Expanded by Needs review');
    act(() => probe.current.layer.selectThread('a1'));
    // The reveal adds its own, unlocked branches beside the locked one.
    expect(toggleOf('B').disabled).toBe(true);
    expect(toggleOf('A').disabled).toBe(false);
  });

  it('stay locked when the reveal forces the same branch too', () => {
    // Needs review showing a1, so both A and A1 are forced by it as well as by the reveal.
    const reviewA: RowVisibility = {
      visibleIds: new Set(['A', 'A1', 'a1']),
      forceOpenIds: new Set(['A', 'A1']),
    };
    const probe = renderReport(tree(), reviewA);
    act(() => probe.current.layer.selectThread('a1'));
    expect(toggleOf('A').disabled).toBe(true);
    expect(toggleOf('A1').disabled).toBe(true);
    expect(toggleOf('A1').title).toBe('Expanded by Needs review');

    // Even called directly, the wrapper treats a locked branch as a plain toggle, not a collapse.
    const toggle = vi.fn<(nodeId: string) => void>();
    act(() => probe.current.layer.toggleExpand('A1', toggle));
    expect(toggle).toHaveBeenCalledWith('A1');
    expect(probe.current.layer.revealNodeId).toBe('a1');
  });
});
