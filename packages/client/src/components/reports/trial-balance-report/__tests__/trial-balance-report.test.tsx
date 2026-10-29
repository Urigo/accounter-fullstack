import { act, useContext, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrialBalanceReport } from '../index.js';
import { TrialBalanceRefreshContext } from '../trial-balance-refresh-context.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { reexecuteQuery, useQueryMock } = vi.hoisted(() => ({
  reexecuteQuery: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock('urql', async importOriginal => ({
  ...(await importOriginal<typeof import('urql')>()),
  useQuery: useQueryMock,
}));

vi.mock('../trial-balance-report-filters.js', () => ({
  TrialBalanceReportFilters: (): null => null,
}));

// Stands in for the table and its expanded entities: refreshes the report like an insert does
vi.mock('../trial-balance-table.js', () => ({
  TrialBalanceTable: (): ReactElement => {
    const refresh = useContext(TrialBalanceRefreshContext);
    return (
      <button type="button" data-testid="trial-balance-table" onClick={() => refresh?.()}>
        table
      </button>
    );
  },
}));

const DATA = {
  businessTransactionsSumFromLedgerRecords: {
    __typename: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult',
  },
};

describe('TrialBalanceReport', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    reexecuteQuery.mockReset();
    useQueryMock.mockReset().mockReturnValue([{ data: DATA, fetching: false }, reexecuteQuery]);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter>
          <TrialBalanceReport />
        </MemoryRouter>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const table = (): Element | null =>
    container.querySelector('[data-testid="trial-balance-table"]');

  it('refetches the totals from the network, keeping the table (and its expanded rows) mounted', async () => {
    await act(async () => {
      (table() as HTMLElement).click();
    });
    expect(reexecuteQuery).toHaveBeenCalledWith({ requestPolicy: 'network-only' });

    // The refetch is in flight: the table stays instead of the loading spinner
    useQueryMock.mockReturnValue([{ data: DATA, fetching: true }, reexecuteQuery]);
    await act(async () => {
      root.render(
        <MemoryRouter>
          <TrialBalanceReport />
        </MemoryRouter>,
      );
    });
    expect(table()).not.toBeNull();
  });
});
