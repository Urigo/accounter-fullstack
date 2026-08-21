// @vitest-environment happy-dom

import { useState, type ReactElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { FiltersContext } from '../../../../providers/filters-context.js';
import { Securities } from '../index.js';

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }));

vi.mock('urql', () => ({
  useQuery: useQueryMock,
}));

vi.mock('../../../common/index.js', async () => {
  const pagination =
    await vi.importActual<typeof import('../../../common/data-table-pagination.js')>(
      '../../../common/data-table-pagination.js',
    );
  const skeleton =
    await vi.importActual<typeof import('../../../common/loaders/table-skeleton.js')>(
      '../../../common/loaders/table-skeleton.js',
    );
  return {
    // Keep the real pagination bar: it is what the screen pushes into the filters context, and
    // the render loop the harness guards against went through it.
    DataTablePagination: pagination.DataTablePagination,
    TableSkeleton: skeleton.TableSkeleton,
  };
});

/**
 * The descriptor badges read their fields through `getFragmentData`, which asserts on the
 * fragment document at runtime. Stubbing it keeps these cases about the screen rather than about
 * fragment masking.
 */
vi.mock('../../../securities/security-descriptor-badges.js', () => ({
  SecurityDescriptorBadges: () => null,
}));

function holding(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `security-${index}`,
    security: {
      id: `security-${index}`,
      isin: `US000000${String(index).padStart(4, '0')}`,
      symbol: `SYM${index}`,
      engName: `Example Corp ${index}`,
      hebName: null,
      currencyCode: 'USD',
      exchange: 'NYQ',
      identifiers: [{ id: `identifier-${index}`, type: 'POALIM_SECURITY_KEY', value: `10${index}` }],
    },
    position: {
      id: `security-${index}`,
      quantity: index + 1,
      averageCost: { raw: 100 + index, formatted: `$${100 + index}` },
      totalBought: { raw: 1000 + index, formatted: `$${1000 + index}` },
      totalSold: { raw: 0, formatted: '$0' },
      historyStartDate: '2024-01-05',
      lastExecutionDate: '2024-03-10',
    },
    ...overrides,
  };
}

const securityHoldings = Array.from({ length: 120 }, (_, index) => holding(index));

/**
 * Types into a controlled input. Assigning `.value` directly is invisible to React — it tracks
 * the last value it wrote and skips the change as a no-op — so go through the prototype's setter
 * before dispatching, which is what React's own test utilities do.
 */
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** A render loop never settles, so it would hang the runner instead of failing. */
const MAX_RENDERS = 50;
let renderCount = 0;

/** Mirrors DashboardLayoutRoute: the filters context is parent state, so every
 * `setFiltersContext` call re-renders the screen below it. */
function Screen(): ReactElement {
  renderCount += 1;
  if (renderCount > MAX_RENDERS) {
    throw new Error(`Render loop detected: the screen re-rendered more than ${MAX_RENDERS} times`);
  }
  const [filtersContext, setFiltersContext] = useState<ReactElement | null>(null);
  return (
    <FiltersContext.Provider value={{ filtersContext, setFiltersContext }}>
      {filtersContext}
      <Securities />
    </FiltersContext.Provider>
  );
}

/** The name cell renders a `Link`, so the screen needs a router around it. */
function Harness(): ReactElement {
  return <RouterProvider router={createMemoryRouter([{ path: '/', element: <Screen /> }])} />;
}

describe('Securities screen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleError: MockInstance<typeof console.error>;

  const mockHoldings = (holdings: unknown[]) =>
    useQueryMock.mockReturnValue([
      { data: { securityHoldings: holdings }, fetching: false, error: undefined },
      vi.fn(),
    ]);

  beforeEach(() => {
    renderCount = 0;
    useQueryMock.mockReset();
    mockHoldings(securityHoldings);
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

  // Regression guard inherited from the sort-codes screen: an effect depending on the `useTable`
  // handle re-runs forever against the parent's `setFiltersContext` state.
  it('renders without exceeding the maximum update depth', () => {
    expect(() => {
      act(() => root.render(<Harness />));
    }).not.toThrow();

    const loopErrors = consoleError.mock.calls.filter(call =>
      call.some(arg => String(arg).includes('Maximum update depth exceeded')),
    );
    expect(loopErrors).toHaveLength(0);
    expect(renderCount).toBeLessThan(MAX_RENDERS);
    expect(container.textContent).toContain('Securities (120)');
  });

  it('publishes the pagination bar into the filters context', () => {
    act(() => root.render(<Harness />));

    // 120 rows at a page size of 100 => 2 pages, rendered by DataTablePagination.
    expect(container.textContent).toContain('Page 1 of 2');
  });

  it('asks the server for closed positions only once the toggle is on', () => {
    act(() => root.render(<Harness />));

    expect(useQueryMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ variables: { includeClosed: false } }),
    );

    const toggle = container.querySelector('#include-closed');
    expect(toggle).not.toBeNull();
    act(() => {
      (toggle as HTMLElement).click();
    });

    expect(useQueryMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ variables: { includeClosed: true } }),
    );
  });

  it('narrows the table to what the search matches', () => {
    mockHoldings([holding(1), holding(2)]);
    act(() => root.render(<Harness />));

    expect(container.textContent).toContain('Example Corp 1');
    expect(container.textContent).toContain('Example Corp 2');

    const input = container.querySelector('input[placeholder^="Search"]') as HTMLInputElement;
    act(() => typeInto(input, 'SYM2'));

    expect(container.textContent).not.toContain('Example Corp 1');
    expect(container.textContent).toContain('Example Corp 2');
    expect(container.textContent).toContain('Securities (1)');
  });

  it('renders an em dash for a position with no currency to report amounts in', () => {
    mockHoldings([
      holding(1, {
        position: {
          id: 'security-1',
          quantity: 4,
          averageCost: null,
          totalBought: null,
          totalSold: null,
          historyStartDate: null,
          lastExecutionDate: null,
        },
      }),
    ]);

    expect(() => {
      act(() => root.render(<Harness />));
    }).not.toThrow();
    expect(container.textContent).toContain('—');
  });

  it('links each security to its own page', () => {
    mockHoldings([holding(7)]);
    act(() => root.render(<Harness />));

    const link = container.querySelector('a[href="/businesses/security-7"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('Example Corp 7');
  });

  it('points at the toggle when nothing is held', () => {
    mockHoldings([]);
    act(() => root.render(<Harness />));

    expect(container.textContent).toContain('No open positions');
    expect(container.textContent).toContain('Show closed positions');
  });
});
