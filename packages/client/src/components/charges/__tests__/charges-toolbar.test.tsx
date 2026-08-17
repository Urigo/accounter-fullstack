// @vitest-environment happy-dom

import React, { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Provider, createClient } from 'urql';
import { describe, expect, it, vi } from 'vitest';
import { useTable, type RowSelectionState, type SortingState } from '@tanstack/react-table';
import { tableFeaturesConfig } from '@/lib/table-features.js';
import {
  AccountantStatus,
  ChargeSortByField,
  type ChargeSortBy,
} from '../../../gql/graphql.js';
import type { ChargeRow } from '../charges-table.js';
import { ChargesToolbar, SERVER_SORT_OPTIONS } from '../charges-toolbar.js';
import { CLIENT_SORT_OPTIONS } from '../charges-sort-menu.js';
import { columns } from '../columns.js';
import type { ChargeDensity } from '../use-charge-density.js';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

// The toolbar's children (batch-actions menu, CSV export) hold urql hooks. They never fire during
// these tests but need a client in context to mount, so this one carries no exchanges — nothing can
// reach the network even if an operation were dispatched.
const client = createClient({ url: '/graphql', exchanges: [] });

function makeRow(id: string, description: string): ChargeRow {
  return {
    id,
    type: 'CommonCharge',
    description,
    tags: [],
    suggestedTags: [],
    counts: { transactions: 0, documents: 0, ledger: 0, miscExpenses: 0 },
    missingInfo: [],
    accountantApproval: AccountantStatus.Unapproved,
  };
}

/** Drives a real table instance so the toolbar is exercised against the same API the screen uses. */
function Harness({
  rows,
  rowSelection,
  onRowSelectionChange,
  showExport = false,
  sort,
  sorting = [],
  onSortingChange = () => {},
  density = 'comfortable',
  onDensityChange = () => {},
}: {
  rows: ChargeRow[];
  rowSelection: RowSelectionState;
  onRowSelectionChange: (updater: unknown) => void;
  showExport?: boolean;
  sort?: { value?: ChargeSortBy | null; onChange: (next: ChargeSortBy) => void };
  sorting?: SortingState;
  onSortingChange?: (updater: unknown) => void;
  density?: ChargeDensity;
  onDensityChange?: (next: ChargeDensity) => void;
}): ReactElement {
  const table = useTable({
    features: tableFeaturesConfig,
    data: rows,
    columns,
    getRowId: row => row.id,
    enableRowSelection: true,
    onRowSelectionChange,
    state: { rowSelection },
  });
  return (
    <ChargesToolbar
      table={table}
      showExport={showExport}
      exportIds={rows.map(row => row.id)}
      sort={sort}
      sorting={sorting}
      onSortingChange={onSortingChange as never}
      density={density}
      onDensityChange={onDensityChange}
    />
  );
}

async function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(<Provider value={client}>{element}</Provider>);
    await Promise.resolve();
  });

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { container, cleanup };
}

const ROWS = [makeRow('c1', 'Cloud spend'), makeRow('c2', 'Office chairs'), makeRow('c3', 'Coffee')];

describe('ChargesToolbar', () => {
  it('reports the row count when nothing is selected', async () => {
    const { container, cleanup } = await render(
      <Harness rows={ROWS} rowSelection={{}} onRowSelectionChange={() => {}} />,
    );

    expect(container.textContent).toContain('3 charges');
    await cleanup();
  });

  it('singularises a one-charge list', async () => {
    const { container, cleanup } = await render(
      <Harness rows={[ROWS[0]!]} rowSelection={{}} onRowSelectionChange={() => {}} />,
    );

    expect(container.textContent).toContain('1 charge');
    expect(container.textContent).not.toContain('1 charges');
    await cleanup();
  });

  it('announces the selection, replacing what a bare header checkbox never conveyed', async () => {
    const { container, cleanup } = await render(
      <Harness rows={ROWS} rowSelection={{ c1: true, c3: true }} onRowSelectionChange={() => {}} />,
    );

    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe('2 of 3 selected');
    await cleanup();
  });

  it('drives selection through the table when select-all is clicked', async () => {
    const onRowSelectionChange = vi.fn();
    const { container, cleanup } = await render(
      <Harness rows={ROWS} rowSelection={{}} onRowSelectionChange={onRowSelectionChange} />,
    );

    const checkbox = container.querySelector<HTMLElement>('[aria-label="Select all charges"]');
    expect(checkbox).not.toBeNull();

    await act(async () => {
      checkbox!.click();
      await Promise.resolve();
    });

    expect(onRowSelectionChange).toHaveBeenCalled();
    // Selection is keyed by charge id (via `getRowId`), not row index, so it survives sorting.
    const updater = onRowSelectionChange.mock.calls[0]![0] as
      | RowSelectionState
      | ((old: RowSelectionState) => RowSelectionState);
    const next = typeof updater === 'function' ? updater({}) : updater;
    expect(Object.keys(next).sort()).toEqual(['c1', 'c2', 'c3']);

    await cleanup();
  });

  it('hides the CSV export unless the screen asks for it', async () => {
    // `DownloadCSVButton` is icon-only and keeps its label in a tooltip, so there is no text to
    // match — `aria-busy` is the attribute unique to it within this toolbar.
    const without = await render(
      <Harness rows={ROWS} rowSelection={{}} onRowSelectionChange={() => {}} />,
    );
    expect(without.container.querySelector('[aria-busy]')).toBeNull();
    await without.cleanup();

    const withExport = await render(
      <Harness rows={ROWS} rowSelection={{}} onRowSelectionChange={() => {}} showExport />,
    );
    expect(withExport.container.querySelector('[aria-busy]')).not.toBeNull();
    await withExport.cleanup();
  });

  it('shows the server sort field and scopes it to all matching charges', async () => {
    const { container, cleanup } = await render(
      <Harness
        rows={ROWS}
        rowSelection={{}}
        onRowSelectionChange={() => {}}
        sort={{ value: { field: ChargeSortByField.AbsAmount, asc: false }, onChange: () => {} }}
      />,
    );

    const trigger = container.querySelector<HTMLElement>('[aria-label="Sort charges"]');
    expect(trigger).not.toBeNull();
    expect(trigger!.textContent).toContain('Absolute amount');
    await cleanup();
  });

  it('falls back to the loaded-charges sort when the screen owns no filter', async () => {
    const { container, cleanup } = await render(
      <Harness
        rows={ROWS}
        rowSelection={{}}
        onRowSelectionChange={() => {}}
        sorting={[{ id: 'counterparty', desc: false }]}
      />,
    );

    // Reads the label for the explicit column id, not tanstack's derived
    // `counterparty_counterparty_name`.
    expect(
      container.querySelector('[aria-label="Sort charges"]')?.textContent,
    ).toContain('Counterparty');
    await cleanup();
  });

  it('hides the sort control when there is only one charge to order', async () => {
    // The single-charge screen renders exactly one record; a sort menu there read "None" and did
    // nothing.
    const { container, cleanup } = await render(
      <Harness rows={[ROWS[0]!]} rowSelection={{}} onRowSelectionChange={() => {}} />,
    );
    expect(container.querySelector('[aria-label="Sort charges"]')).toBeNull();
    await cleanup();
  });

  it('offers exactly the fields the server can sort by, and no others', async () => {
    // Guards against the menu drifting from the GraphQL enum — offering a field the server rejects
    // would fail at query time, and omitting one silently loses a capability.
    expect(SERVER_SORT_OPTIONS.map(option => option.value).sort()).toEqual(
      Object.values(ChargeSortByField).sort(),
    );
  });

  it('offers only client-sortable column ids in the fallback menu', async () => {
    // Every fallback option must name a real sortable column, or selecting it would set `sorting`
    // to an id no column answers to and quietly do nothing — the Date-column bug in another guise.
    const sortableIds = columns
      .filter(column => column.enableSorting !== false)
      .map(column => column.id);
    for (const option of CLIENT_SORT_OPTIONS) {
      expect(sortableIds, option.value).toContain(option.value);
    }
  });

  it('never renders both bindings at once, so the two sorts cannot fight', async () => {
    const { container, cleanup } = await render(
      <Harness
        rows={ROWS}
        rowSelection={{}}
        onRowSelectionChange={() => {}}
        sort={{ value: { field: ChargeSortByField.Date, asc: true }, onChange: () => {} }}
        sorting={[{ id: 'amount', desc: true }]}
      />,
    );

    expect(container.querySelectorAll('[aria-label="Sort charges"]')).toHaveLength(1);
    // The server binding wins; the stale client `sorting` is not surfaced.
    const label = container.querySelector('[aria-label="Sort charges"]')?.textContent ?? '';
    expect(label).toContain('Date');
    expect(label).not.toContain('Amount');
    await cleanup();
  });

  it('toggles density, and reports the current mode as a pressed state', async () => {
    const onDensityChange = vi.fn();
    const { container, cleanup } = await render(
      <Harness
        rows={ROWS}
        rowSelection={{}}
        onRowSelectionChange={() => {}}
        density="comfortable"
        onDensityChange={onDensityChange}
      />,
    );

    const toggle = container.querySelector<HTMLElement>('[aria-label="Compact density"]');
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      toggle!.click();
      await Promise.resolve();
    });
    expect(onDensityChange).toHaveBeenCalledWith('compact');
    await cleanup();
  });

  it('offers the way back out of compact', async () => {
    const onDensityChange = vi.fn();
    const { container, cleanup } = await render(
      <Harness
        rows={ROWS}
        rowSelection={{}}
        onRowSelectionChange={() => {}}
        density="compact"
        onDensityChange={onDensityChange}
      />,
    );

    const toggle = container.querySelector<HTMLElement>('[aria-label="Comfortable density"]');
    expect(toggle!.getAttribute('aria-pressed')).toBe('true');
    await act(async () => {
      toggle!.click();
      await Promise.resolve();
    });
    expect(onDensityChange).toHaveBeenCalledWith('comfortable');
    await cleanup();
  });

  it('exposes the batch-actions menu', async () => {
    const { container, cleanup } = await render(
      <Harness rows={ROWS} rowSelection={{ c1: true }} onRowSelectionChange={() => {}} />,
    );

    expect(container.querySelector('[aria-label="Batch charge actions"]')).not.toBeNull();
    await cleanup();
  });
});
