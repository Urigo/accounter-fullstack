// @vitest-environment happy-dom

import { useState, type ReactElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
  sortCode: { id: `sort-code-${index}`, key: index, name: `Sort Code ${index}` },
  irsCode: index,
  taxExcluded: index % 2 === 0,
  // Every third category is some business's default; the rest have nothing to expand.
  businesses:
    index % 3 === 0
      ? [{ id: `business-${index}`, name: `Business ${index}` }]
      : [],
}));

/** A render loop never settles, so it would hang the runner instead of failing.
 * Bail out well above the handful of renders a healthy mount needs. */
const MAX_RENDERS = 50;
let renderCount = 0;

/** Records the live query string so tests can assert what the screen wrote. */
let currentSearch = '';
function LocationProbe(): null {
  currentSearch = useLocation().search;
  return null;
}

/** Mirrors DashboardLayoutRoute: the filters context is parent state, so every
 * `setFiltersContext` call re-renders the screen below it. */
function Harness({ initialEntry = '/tax-categories' }: { initialEntry?: string }): ReactElement {
  renderCount += 1;
  if (renderCount > MAX_RENDERS) {
    throw new Error(`Render loop detected: the screen re-rendered more than ${MAX_RENDERS} times`);
  }
  const [filtersContext, setFiltersContext] = useState<ReactElement | null>(null);
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <FiltersContext.Provider value={{ filtersContext, setFiltersContext }}>
        {filtersContext}
        <TaxCategories />
      </FiltersContext.Provider>
    </MemoryRouter>
  );
}

/** The header button that toggles sorting for a column. */
function sortHeader(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find(
    candidate => candidate.textContent?.trim() === label,
  );
  if (!button) {
    throw new Error(`No sort header labelled "${label}"`);
  }
  return button as HTMLButtonElement;
}

/** Names in the order the table currently renders them. Reads the name cell
 * rather than the row text, which runs the name straight into the sort code. */
function renderedNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('tbody tr')].flatMap(row => {
    const cells = row.querySelectorAll('td');
    // Skip an expanded sub-row, which is a single full-width cell.
    return cells.length > 1 ? [cells[1].textContent ?? ''] : [];
  });
}

describe('TaxCategories screen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    renderCount = 0;
    currentSearch = '';
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

  it('expands a row into links to the businesses it is the default for', () => {
    act(() => root.render(<Harness />));

    // Only rows with businesses get an expander; `Tax Category 0` is the first.
    const expander = container.querySelector<HTMLButtonElement>(
      '[aria-label="Show businesses of Tax Category 0"]',
    );
    expect(expander).not.toBeNull();

    act(() => expander!.click());

    const link = container.querySelector<HTMLAnchorElement>('a[href="/businesses/business-0"]');
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe('Business 0');
  });

  it('offers no expander for a tax category no business defaults to', () => {
    act(() => root.render(<Harness />));

    // `Tax Category 1` has an empty `businesses` list.
    expect(
      container.querySelector('[aria-label="Show businesses of Tax Category 1"]'),
    ).toBeNull();
  });

  it('opens a business in a new tab, as a distinct bulleted entry', () => {
    act(() => root.render(<Harness />));

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Show businesses of Tax Category 0"]')!
        .click();
    });

    // Bulleted list items, so a long name wrapping to a second line cannot read
    // as a second business.
    const list = container.querySelector('ul')!;
    expect(list.className).toContain('list-disc');
    expect(list.querySelectorAll('li')).toHaveLength(1);

    const link = container.querySelector<HTMLAnchorElement>('a[href="/businesses/business-0"]')!;
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });
});

describe('TaxCategories table state in the URL', () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    renderCount = 0;
    currentSearch = '';
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue([
      { data: { taxCategories }, fetching: false, error: undefined },
      refetchMock,
    ]);
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

  it('restores page, page size and sort from a shared link', () => {
    act(() =>
      root.render(<Harness initialEntry="/tax-categories?page=2&pageSize=10&sort=name:desc" />),
    );

    // 45 rows at 10 per page => 5 pages, and the link asked for the second.
    expect(container.textContent).toContain('Page 2 of 5');
    // TanStack's default sort is alphanumeric, so the trailing numbers compare
    // as numbers: descending runs 44..35 on page 1 and starts at 34 on page 2.
    const names = renderedNames(container);
    expect(names).toHaveLength(10);
    expect(names[0]).toBe('Tax Category 34');
  });

  it('writes paging to the URL', () => {
    act(() => root.render(<Harness />));
    expect(currentSearch).toBe('');

    act(() => {
      [...container.ownerDocument.querySelectorAll('button')]
        .find(button => button.textContent?.includes('Go to next page'))!
        .click();
    });

    expect(new URLSearchParams(currentSearch).get('page')).toBe('2');
    expect(container.textContent).toContain('Page 2 of 2');
  });

  it('writes sorting to the URL and returns to the first page', () => {
    act(() => root.render(<Harness initialEntry="/tax-categories?page=2" />));

    act(() => sortHeader(container, 'Name').click());

    const params = new URLSearchParams(currentSearch);
    expect(params.get('sort')).toBe('name:asc');
    // Re-sorting reorders everything, so page 2 would show unrelated rows.
    expect(params.get('page')).toBeNull();
    expect(container.textContent).toContain('Page 1 of 2');
  });

  it('leaves unrelated query params alone', () => {
    act(() => root.render(<Harness initialEntry="/tax-categories?keep=me" />));

    act(() => sortHeader(container, 'IRS Code').click());

    expect(new URLSearchParams(currentSearch).get('keep')).toBe('me');
  });

  it('lands on the last real page when the link points past the end', () => {
    act(() => root.render(<Harness initialEntry="/tax-categories?page=9" />));

    expect(container.textContent).toContain('Page 2 of 2');
    expect(new URLSearchParams(currentSearch).get('page')).toBe('2');
    expect(renderCount).toBeLessThan(MAX_RENDERS);
  });
});
