import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountantStatus } from '../../../../gql/graphql.js';
import { RowTrailing, type RowAnnotations } from '../row-trailing.js';
import { TreeNodeRow } from '../tree-node.js';
import { buildNodeStats, formatCurrency, type CustomData, type FlatNode } from '../utils/types.js';

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

const leafNode: FlatNode<CustomData> = {
  id: 'a',
  parent: 'b',
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

const leafAnnotations: RowAnnotations = {
  diff: { changes: [{ kind: 'moved', previousParentText: 'Elsewhere' }], subtreeDelta: 20 },
  approval: {
    kind: 'leaf',
    approval: { status: AccountantStatus.Pending },
    onChange: noop,
    disabledReason: null,
  },
};

const branchAnnotations: RowAnnotations = {
  diff: { changes: [{ kind: 'renamed', previousText: 'Old b' }], subtreeDelta: 20 },
  approval: {
    kind: 'branch',
    counts: { approved: 0, pending: 1, unapproved: 0 },
    onChange: noop,
    disabledReason: null,
  },
};

/**
 * Names the children of the row's trailing end in DOM order, so the tests read as the layout:
 * `diff` markers, the `value` badge, the row's own controls, then each `slot:<layer>`.
 */
function trailing(): string[] {
  const end = container.querySelector('.ml-auto');
  if (!end) throw new Error('no trailing end rendered');
  return [...end.children].map(child => {
    const slot = child.getAttribute('data-row-slot');
    if (slot) {
      const filled = child.querySelector('[data-accountant-status-trigger]') ? '' : ' (empty)';
      return `slot:${slot}${filled}`;
    }
    if (child.tagName === 'BUTTON') return 'control:button';
    if (child.classList.contains('font-mono')) return `value ${child.textContent}`;
    // DiffMarkers renders one `flex` span holding its badges; the other badges are inline-flex.
    if (child.classList.contains('flex')) return `diff ${child.textContent}`;
    return `control:count ${child.textContent}`;
  });
}

function renderRow(
  node: FlatNode<CustomData>,
  treeId: 'bank' | 'report',
  annotations?: RowAnnotations,
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

const value = formatCurrency(120);

describe('row trailing end', () => {
  it('lays out a report leaf as diff, value, controls, then the approval slot', () => {
    renderRow(leafNode, 'report', leafAnnotations);
    expect(trailing()).toEqual([
      `diff ${'+' + formatCurrency(20)}moved`,
      `value ${value}`,
      'control:button',
      'slot:approval',
    ]);
  });

  it('lays out a report branch the same way, with its leaf count among the controls', () => {
    renderRow(branchNode, 'report', branchAnnotations);
    expect(trailing()).toEqual([
      `diff ${'+' + formatCurrency(20)}renamed`,
      `value ${value}`,
      'control:count 1',
      'slot:approval',
    ]);
  });

  it('reserves the approval slot on a report row with nothing to show', () => {
    renderRow(leafNode, 'report');
    expect(trailing()).toEqual([`value ${value}`, 'control:button', 'slot:approval (empty)']);
  });

  it('gives bank rows no slots, whatever their annotations', () => {
    renderRow(leafNode, 'bank', leafAnnotations);
    expect(trailing()).toEqual([
      `diff ${'+' + formatCurrency(20)}moved`,
      `value ${value}`,
      'control:button',
    ]);

    renderRow(branchNode, 'bank', branchAnnotations);
    expect(trailing()).toEqual([
      `diff ${'+' + formatCurrency(20)}renamed`,
      `value ${value}`,
      'control:count 1',
    ]);
  });

  it('keeps the empty slot on a ghost leaf but drops its controls', () => {
    renderRow(leafNode, 'report', {
      diff: { changes: [{ kind: 'removed', previousValue: 120 }], isGhost: true },
    });
    expect(trailing()).toEqual(['diff removed', `value ${value}`, 'slot:approval (empty)']);
    expect(container.querySelector('.line-through')?.textContent).toBe('Entity a');
  });

  it('keeps the empty slot on a ghost branch', () => {
    renderRow(branchNode, 'report', {
      diff: { changes: [{ kind: 'removed', previousValue: 120 }], isGhost: true },
    });
    expect(trailing()).toEqual([
      'diff removed',
      `value ${value}`,
      'control:count 1',
      'slot:approval (empty)',
    ]);
  });
});

describe('RowTrailing', () => {
  it('renders its children between the value and the slots', () => {
    act(() =>
      root.render(
        <RowTrailing annotations={leafAnnotations} value={-5} withSlots>
          <button type="button">x</button>
        </RowTrailing>,
      ),
    );
    expect(trailing()).toEqual([
      `diff ${'+' + formatCurrency(20)}moved`,
      `value ${formatCurrency(-5)}`,
      'control:button',
      'slot:approval',
    ]);
    expect(container.querySelector('.ml-auto > .font-mono')?.className).toContain('bg-red-100');
  });

  it('renders only the value when there is nothing else', () => {
    act(() => root.render(<RowTrailing annotations={{}} value={0} withSlots={false} />));
    expect(trailing()).toEqual([`value ${formatCurrency(0)}`]);
  });
});
