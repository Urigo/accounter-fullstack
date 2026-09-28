import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountantStatus } from '../../../../gql/graphql.js';
import { CommentIndicator, type RowComments } from '../comment-indicator.js';
import { RowTrailing, type RowAnnotations } from '../row-trailing.js';
import { TreeNodeRow } from '../tree-node.js';
import { buildNodeStats, type CustomData, type FlatNode } from '../utils/types.js';

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

function comments(extra: Partial<RowComments> = {}): RowComments {
  return { openBelow: 0, isActive: false, label: 'Acme Ltd', onOpen: noop, ...extra };
}

const OPEN = { threadId: 't1', isOpen: true, messageCount: 3, lastMessageAt: null };
const RESOLVED = { ...OPEN, isOpen: false };

function renderIndicator(value: RowComments): HTMLButtonElement | null {
  act(() => root.render(<CommentIndicator comments={value} />));
  return container.querySelector('button');
}

describe('CommentIndicator', () => {
  it('shows an open thread emphasised, with its message count', () => {
    const button = renderIndicator(comments({ own: OPEN }));
    expect(button?.dataset['commentIndicator']).toBe('open');
    expect(button?.textContent).toBe('3');
    expect(button?.className).toContain('text-sky-700');
    expect(button?.getAttribute('aria-label')).toBe('Open discussion on Acme Ltd, 3 messages');
    expect(button?.getAttribute('aria-pressed')).toBe('false');
  });

  it('mutes a resolved thread', () => {
    const button = renderIndicator(comments({ own: RESOLVED }));
    expect(button?.dataset['commentIndicator']).toBe('resolved');
    expect(button?.className).toContain('text-muted-foreground');
    expect(button?.className).not.toContain('text-sky-700');
    expect(button?.getAttribute('aria-label')).toBe('Resolved discussion on Acme Ltd, 3 messages');
  });

  it('marks the thread that is open in the sheet', () => {
    const button = renderIndicator(comments({ own: OPEN, isActive: true }));
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(button?.className).toContain('ring-sky-400');
  });

  it('shows no count for a thread whose messages are all deleted', () => {
    const button = renderIndicator(comments({ own: { ...OPEN, messageCount: 0 } }));
    expect(button?.textContent).toBe('');
    expect(button?.getAttribute('aria-label')).toBe('Open discussion on Acme Ltd, 0 messages');
  });

  it('shows a dot on a branch with open threads below and none of its own', () => {
    const button = renderIndicator(comments({ openBelow: 2 }));
    expect(button?.dataset['commentIndicator']).toBe('below');
    expect(button?.querySelector('.rounded-full')).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe(
      '2 open threads inside. Start a discussion on Acme Ltd',
    );
  });

  it('prefers the row’s own thread over the dot', () => {
    expect(
      renderIndicator(comments({ own: RESOLVED, openBelow: 4 }))?.dataset['commentIndicator'],
    ).toBe('resolved');
  });

  it('offers a hover-only add button on a row without a thread', () => {
    const button = renderIndicator(comments());
    expect(button?.dataset['commentIndicator']).toBe('add');
    expect(button?.getAttribute('aria-label')).toBe('Add a comment on Acme Ltd');
    expect(button?.className).toContain('opacity-0');
    expect(button?.className).toContain('group-hover:opacity-100');
    // Keyboard users reach it too.
    expect(button?.className).toContain('focus-visible:opacity-100');
  });

  it('keeps the add button visible while its empty thread is open in the sheet', () => {
    const button = renderIndicator(comments({ isActive: true }));
    expect(button?.className).toContain('opacity-100');
    expect(button?.className).not.toContain('opacity-0');
  });

  it('shows a ghost row’s thread read-only', () => {
    const button = renderIndicator(comments({ own: OPEN, readOnly: true }));
    expect(button?.getAttribute('aria-label')).toBe(
      'Open discussion on Acme Ltd, 3 messages, read-only',
    );
  });

  it('offers nothing to start on a ghost row without a thread', () => {
    expect(renderIndicator(comments({ readOnly: true }))).toBeNull();
    expect(renderIndicator(comments({ readOnly: true, openBelow: 1 }))).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('opens the thread on click', () => {
    const onOpen = vi.fn<() => void>();
    for (const value of [
      comments({ own: OPEN, onOpen }),
      comments({ openBelow: 1, onOpen }),
      comments({ onOpen }),
    ]) {
      const button = renderIndicator(value);
      act(() => button?.click());
    }
    expect(onOpen).toHaveBeenCalledTimes(3);
  });
});

// ── The slot ──────────────────────────────────────────────────────────────────────────

const leafNode: FlatNode<CustomData> = {
  id: 'a',
  parent: 'report',
  text: 'Entity a',
  droppable: false,
  data: { nodeType: 'financial-entity', isOpen: false, value: 120 },
};

const branchNode: FlatNode<CustomData> = {
  id: 'b',
  parent: 'report',
  text: 'Branch b',
  droppable: true,
  data: { nodeType: 'synthetic-branch', isOpen: false },
};

const nodeStats = buildNodeStats([branchNode, leafNode]);

const withComments: RowAnnotations = {
  comments: comments({ own: OPEN }),
  approval: {
    kind: 'leaf',
    approval: { status: AccountantStatus.Pending },
    onChange: noop,
    disabledReason: null,
  },
};

function slots(): string[] {
  return [...container.querySelectorAll('[data-row-slot]')].map(
    slot => slot.getAttribute('data-row-slot') ?? '',
  );
}

function renderRow(
  node: FlatNode<CustomData>,
  treeId: 'bank' | 'report',
  annotations: RowAnnotations,
): void {
  act(() =>
    root.render(
      <TreeNodeRow
        node={node}
        depth={0}
        treeId={treeId}
        nodeStats={nodeStats}
        editMode={false}
        onToggleExpand={noop}
        annotations={annotations}
      />,
    ),
  );
}

describe('comments slot', () => {
  it('comes just before the approval slot on report leaves and branches', () => {
    renderRow(leafNode, 'report', withComments);
    expect(slots()).toEqual(['comments', 'approval']);
    const end = container.querySelector('.ml-auto');
    expect(end?.lastElementChild?.getAttribute('data-row-slot')).toBe('approval');
    expect(
      container.querySelector('[data-row-slot="comments"] [data-comment-indicator="open"]'),
    ).not.toBeNull();

    renderRow(branchNode, 'report', { comments: comments({ openBelow: 1 }) });
    expect(slots()).toEqual(['comments', 'approval']);
  });

  it('is a fixed-width slot, reserved even when the row has nothing to show', () => {
    renderRow(leafNode, 'report', { comments: comments({ readOnly: true }) });
    const slot = container.querySelector('[data-row-slot="comments"]');
    expect(slot?.className).toContain('w-7');
    expect(slot?.className).toContain('shrink-0');
    expect(slot?.innerHTML).toBe('');
  });

  it('is not rendered on bank rows', () => {
    renderRow(leafNode, 'bank', withComments);
    expect(slots()).toEqual([]);
    expect(container.querySelector('[data-comment-indicator]')).toBeNull();
  });

  it('is not rendered while the comments layer is off', () => {
    renderRow(leafNode, 'report', { approval: withComments.approval });
    expect(slots()).toEqual(['approval']);
  });

  it('is rendered by RowTrailing itself in the same order', () => {
    act(() => root.render(<RowTrailing annotations={withComments} value={1} withSlots />));
    expect(slots()).toEqual(['comments', 'approval']);
  });

  it('tags report rows with their node id, for scrolling a revealed row into view', () => {
    renderRow(leafNode, 'report', withComments);
    const row = container.querySelector('[data-node-id="a"]');
    expect(row?.getAttribute('data-tree-id')).toBe('report');
  });
});
