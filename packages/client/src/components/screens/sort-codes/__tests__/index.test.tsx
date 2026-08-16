// @vitest-environment happy-dom

import { useState, type ReactElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FiltersContext } from '../../../../providers/filters-context.js';
import { SortCodes } from '../index.js';

const { useQueryMock, refetchMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  refetchMock: vi.fn(),
}));

vi.mock('urql', () => ({
  useQuery: useQueryMock,
}));

vi.mock('../../../common/index.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../../common/data-table-pagination.js')>(
      '../../../common/data-table-pagination.js',
    );
  return {
    // Keep the real pagination bar: it is what the screen pushes into the
    // filters context, and the render loop went through it.
    DataTablePagination: actual.DataTablePagination,
    EditSortCode: () => null,
    InsertSortCode: () => null,
  };
});

const allSortCodes = Array.from({ length: 120 }, (_, index) => ({
  id: `sort-code-${index}`,
  ownerId: 'owner-1',
  key: index,
  name: `Sort Code ${index}`,
  defaultIrsCode: null,
}));

/** A render loop never settles, so it would hang the runner instead of failing.
 * Bail out well above the handful of renders a healthy mount needs. */
const MAX_RENDERS = 50;
let renderCount = 0;

/** Mirrors DashboardLayoutRoute: the filters context is parent state, so every
 * `setFiltersContext` call re-renders the screen below it. */
function Harness(): ReactElement {
  renderCount += 1;
  if (renderCount > MAX_RENDERS) {
    throw new Error(`Render loop detected: the screen re-rendered more than ${MAX_RENDERS} times`);
  }
  const [filtersContext, setFiltersContext] = useState<ReactElement | null>(null);
  return (
    <FiltersContext.Provider value={{ filtersContext, setFiltersContext }}>
      {filtersContext}
      <SortCodes />
    </FiltersContext.Provider>
  );
}

describe('SortCodes screen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    renderCount = 0;
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue([
      { data: { allSortCodes }, fetching: false, error: undefined },
      refetchMock,
    ]);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // Regression: the footer effect used to depend on the `useTable` handle and on
  // `table.getPageOptions()`. Both are freshly allocated on every render, so the
  // effect re-ran forever against the parent's `setFiltersContext` state, and
  // React bailed out with "Maximum update depth exceeded" (minified error #185).
  it('renders without exceeding the maximum update depth', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      act(() => root.render(<Harness />));
    }).not.toThrow();

    const loopErrors = consoleError.mock.calls.filter(call =>
      call.some(arg => String(arg).includes('Maximum update depth exceeded')),
    );
    expect(loopErrors).toHaveLength(0);
    consoleError.mockRestore();

    expect(renderCount).toBeLessThan(MAX_RENDERS);
    expect(container.textContent).toContain('Sort Codes (120)');
  });

  it('publishes the pagination bar into the filters context', () => {
    act(() => root.render(<Harness />));

    // 120 rows at a page size of 100 => 2 pages, rendered by DataTablePagination.
    expect(container.textContent).toContain('Page 1 of 2');
  });
});
