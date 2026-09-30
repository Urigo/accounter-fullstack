import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountantStatus } from '../../../../gql/graphql.js';
import { TreePanel } from '../tree-panel.js';
import { needsReviewVisibility } from '../utils/approvals.js';
import type { CustomData, FlatNode } from '../utils/types.js';
import { isNarrowing, mergeVisibility, type RowVisibility } from '../utils/visibility.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const narrow = (visible: string[], open: string[] = []): RowVisibility => ({
  visibleIds: new Set(visible),
  forceOpenIds: new Set(open),
});
const everyRow = (open: string[] = []): RowVisibility => ({
  visibleIds: null,
  forceOpenIds: new Set(open),
});

describe('mergeVisibility', () => {
  it('gives null for two absent overlays', () => {
    expect(mergeVisibility(null, null)).toBeNull();
  });

  it('returns the other overlay unchanged when one is absent', () => {
    const review = narrow(['a', 'A'], ['A']);
    expect(mergeVisibility(review, null)).toBe(review);
    expect(mergeVisibility(null, review)).toBe(review);
    const reveal = everyRow(['A']);
    expect(mergeVisibility(null, reveal)).toBe(reveal);
  });

  it('shows a row when either overlay shows it', () => {
    const merged = mergeVisibility(narrow(['a', 'A'], ['A']), narrow(['b', 'B'], ['B']));
    expect(merged).toEqual(narrow(['a', 'A', 'b', 'B'], ['A', 'B']));
  });

  it('lets an overlay that shows every row absorb one that narrows', () => {
    expect(mergeVisibility(everyRow(), narrow(['a']))?.visibleIds).toBeNull();
    expect(mergeVisibility(narrow(['a']), everyRow())?.visibleIds).toBeNull();
    expect(mergeVisibility(everyRow(), everyRow())?.visibleIds).toBeNull();
  });

  it('always unions the force-open branches, whatever the rows shown', () => {
    expect(mergeVisibility(everyRow(['A']), narrow(['b', 'B'], ['B']))?.forceOpenIds).toEqual(
      new Set(['A', 'B']),
    );
    expect(mergeVisibility(everyRow(['A']), everyRow(['A', 'C']))?.forceOpenIds).toEqual(
      new Set(['A', 'C']),
    );
  });

  it('never mutates its inputs', () => {
    const a = narrow(['a'], ['A']);
    const b = narrow(['b'], ['B']);
    const merged = mergeVisibility(a, b)!;
    merged.visibleIds!.add('x');
    merged.forceOpenIds.add('x');
    expect(a).toEqual(narrow(['a'], ['A']));
    expect(b).toEqual(narrow(['b'], ['B']));
  });

  it('is commutative and associative', () => {
    const overlays = [narrow(['a'], ['A']), everyRow(['B']), narrow(['c', 'C'], ['C']), null];
    for (const x of overlays) {
      for (const y of overlays) {
        expect(mergeVisibility(x, y)).toEqual(mergeVisibility(y, x));
        for (const z of overlays) {
          expect(mergeVisibility(mergeVisibility(x, y), z)).toEqual(
            mergeVisibility(x, mergeVisibility(y, z)),
          );
        }
      }
    }
  });

  it('keeps the Needs review overlay a narrowing RowVisibility', () => {
    const review: RowVisibility = needsReviewVisibility([], () => undefined);
    expect(isNarrowing(review)).toBe(true);
    expect(isNarrowing(everyRow(['A']))).toBe(false);
    expect(isNarrowing(null)).toBe(false);
  });
});

// ── How TreePanel renders a RowVisibility ─────────────────────────────────────────

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
    data: { nodeType: 'financial-entity', isOpen: false, value: 1 },
  };
}

function branch(id: string, parent: string): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Branch ${id}`,
    droppable: true,
    data: { nodeType: 'synthetic-branch', isOpen: false },
  };
}

const noop = (): void => {};

// report
// ├─ A (closed)
// │  └─ a1 approved
// └─ B (closed)
//    └─ b1 pending
const nodes = [branch('A', 'report'), leaf('a1', 'A'), branch('B', 'report'), leaf('b1', 'B')];
const statuses = new Map([
  ['a1', AccountantStatus.Approved],
  ['b1', AccountantStatus.Pending],
]);
const review = needsReviewVisibility(nodes, id => statuses.get(id));

function renderReport(visibility: RowVisibility | null): string {
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
        reviewVisibility={visibility}
      />,
    ),
  );
  return container.textContent ?? '';
}

describe('TreePanel with a RowVisibility', () => {
  it('renders every row, force-opening branches, for an overlay that shows every row', () => {
    const text = renderReport(everyRow(['A']));
    expect(text).toContain('Branch A');
    expect(text).toContain('Entity a1'); // forced open
    expect(text).toContain('Branch B');
    expect(text).not.toContain('Entity b1'); // still closed
    expect(container.querySelector<HTMLButtonElement>('[data-expand-toggle="A"]')!.disabled).toBe(
      true,
    );
    expect(container.querySelector<HTMLButtonElement>('[data-expand-toggle="B"]')!.disabled).toBe(
      false,
    );
  });

  it('shows the rows a second overlay adds to the Needs review view', () => {
    const text = renderReport(mergeVisibility(review, narrow(['A', 'a1'], ['A'])));
    expect(text).toContain('Entity b1'); // needs review
    expect(text).toContain('Entity a1'); // approved, but revealed
  });

  it('says nothing needs review only while an overlay narrows the rows', () => {
    const approvedOnly = [branch('A', 'report'), leaf('a1', 'A')];
    const approvedReview = needsReviewVisibility(approvedOnly, () => AccountantStatus.Approved);
    act(() =>
      root.render(
        <TreePanel
          treeId="report"
          title="Report"
          nodes={approvedOnly}
          editMode={false}
          emptyMessage="empty"
          onAddBranch={noop}
          onToggleExpand={noop}
          reviewVisibility={approvedReview}
        />,
      ),
    );
    expect(container.textContent).toContain('Nothing needs review');

    const text = renderReport(everyRow());
    expect(text).not.toContain('Nothing needs review');
    expect(text).toContain('Branch A');
  });
});
