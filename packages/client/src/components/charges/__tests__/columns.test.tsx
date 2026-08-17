// @vitest-environment happy-dom

import React, { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { useTable, type SortingState } from '@tanstack/react-table';
import { tableFeaturesConfig } from '@/lib/table-features.js';
import { AccountantStatus, Currency } from '../../../gql/graphql.js';
import type { ChargeRow } from '../charges-table.js';
import { columns } from '../columns.js';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeRow(id: string, date: string | undefined, amount: number | undefined): ChargeRow {
  return {
    id,
    type: 'CommonCharge',
    dates: date ? { date: new Date(date) } : undefined,
    amount:
      amount === undefined
        ? undefined
        : { value: amount, currency: Currency.Ils, shouldValidate: false },
    description: `charge ${id}`,
    tags: [],
    suggestedTags: [],
    counts: { transactions: 0, documents: 0, ledger: 0, miscExpenses: 0 },
    missingInfo: [],
    accountantApproval: AccountantStatus.Unapproved,
  };
}

/** Reports the id order the table's sorted row model produces, so we assert on real sort output. */
function SortProbe({
  rows,
  sorting,
  onOrder,
}: {
  rows: ChargeRow[];
  sorting: SortingState;
  onOrder: (ids: string[]) => void;
}): ReactElement {
  const table = useTable({
    features: tableFeaturesConfig,
    data: rows,
    columns,
    getRowId: row => row.id,
    state: { sorting },
  });
  onOrder(table.getRowModel().rows.map(row => row.original.id));
  return <div />;
}

async function sortedIds(rows: ChargeRow[], sorting: SortingState): Promise<string[]> {
  const container = document.createElement('div');
  document.body.append(container);
  let ids: string[] = [];
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(<SortProbe rows={rows} sorting={sorting} onOrder={next => (ids = next)} />);
    await Promise.resolve();
  });
  await act(async () => {
    root?.unmount();
    await Promise.resolve();
  });
  container.remove();
  return ids;
}

// Deliberately not in date order, so a no-op sort is distinguishable from a working one.
const ROWS = [
  makeRow('mar', '2026-03-15', -100),
  makeRow('jan', '2026-01-05', -3000),
  makeRow('feb', '2026-02-20', 250),
];

describe('date column sorting', () => {
  /**
   * Regression test for a sort that silently did nothing. `accessorKey: 'date'` yielded the whole
   * `DateProps` object; tanstack's `auto` sort saw neither a Date nor a string, fell back to
   * `sortFn_basic`, and compared `"[object Object]" > "[object Object]"` — returning -1 for every
   * pair, so the input order survived untouched. Against these rows that looked like
   * ['mar','jan','feb'] for both directions.
   */
  it('orders ascending by date', async () => {
    expect(await sortedIds(ROWS, [{ id: 'date', desc: false }])).toEqual(['jan', 'feb', 'mar']);
  });

  it('orders descending by date', async () => {
    expect(await sortedIds(ROWS, [{ id: 'date', desc: true }])).toEqual(['mar', 'feb', 'jan']);
  });

  it('actually reorders — the unsorted order is not already correct', async () => {
    expect(await sortedIds(ROWS, [])).toEqual(['mar', 'jan', 'feb']);
  });

  it('keeps charges without a date from breaking the order', async () => {
    const withUndated = [...ROWS, makeRow('none', undefined, -5)];
    const ids = await sortedIds(withUndated, [{ id: 'date', desc: false }]);
    expect(ids).toHaveLength(4);
    // The three dated charges keep their relative order regardless of where the undated one lands.
    expect(ids.filter(id => id !== 'none')).toEqual(['jan', 'feb', 'mar']);
  });
});

describe('amount column sorting', () => {
  it('orders by magnitude, ignoring income/expense sign', async () => {
    // -100, 250, -3000 → 100, 250, 3000
    expect(await sortedIds(ROWS, [{ id: 'amount', desc: false }])).toEqual([
      'mar',
      'feb',
      'jan',
    ]);
  });
});
