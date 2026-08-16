// @vitest-environment happy-dom

import { useState, type ReactElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { FiltersContext } from '../../../providers/filters-context.js';
import { TaxCategories } from '../index.js';

const { useQueryMock, refetchMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  refetchMock: vi.fn(),
}));

vi.mock('urql', () => ({
  useQuery: useQueryMock,
}));

vi.mock('../../common/modals/edit-tax-category.js', () => ({
  EditTaxCategory: () => null,
}));

vi.mock('../../common/index.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/data-table-pagination.js')>(
      '../../common/data-table-pagination.js',
    );
  return {
    // Keep the real pagination bar: it is what the screen pushes into the
    // filters context, and the render loop went through it.
    DataTablePagination: actual.DataTablePagination,
    InsertTaxCategory: () => null,
  };
});

const taxCategories = Array.from({ length: 45 }, (_, index) => ({
  id: `tax-category-${index}`,
  name: `Tax Category ${index}`,
  sortCode: { id: index, key: index, name: `Sort Code ${index}` },
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
      <TaxCategories />
    </FiltersContext.Provider>
  );
}

describe('TaxCategories screen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    renderCount = 0;
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue([
      { data: { taxCategories }, fetching: false, error: undefined },
      refetchMock,
    ]);
    // Set up (and tear down) in the hooks so a failing assertion cannot leak the
    // spy into later tests.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    consoleError.mockRestore();
  });

  // Regression: the footer effect used to depend on the `useTable` handle and on
  // `table.getPageOptions()`. Both are freshly allocated on every render, so the
  // effect re-ran forever against the parent's `setFiltersContext` state, and
  // React bailed out with "Maximum update depth exceeded" (minified error #185).
  it('renders without exceeding the maximum update depth', () => {
    expect(() => {
      act(() => root.render(<Harness />));
    }).not.toThrow();

    const loopErrors = consoleError.mock.calls.filter(call =>
      call.some(arg => String(arg).includes('Maximum update depth exceeded')),
    );
    expect(loopErrors).toHaveLength(0);

    expect(renderCount).toBeLessThan(MAX_RENDERS);
    expect(container.textContent).toContain('Tax Categories (45)');
  });

  it('publishes the pagination bar into the filters context', () => {
    act(() => root.render(<Harness />));

    // 45 rows at a page size of 30 => 2 pages, rendered by DataTablePagination.
    expect(container.textContent).toContain('Page 1 of 2');
  });
});
