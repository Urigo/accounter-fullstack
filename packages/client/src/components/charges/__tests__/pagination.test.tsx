// @vitest-environment happy-dom

import React, { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { useTable } from '@tanstack/react-table';
import { tableFeaturesConfig } from '@/lib/table-features.js';
import { AccountantStatus } from '../../../gql/graphql.js';
import type { ChargeRow } from '../charges-table.js';
import { columns } from '../columns.js';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeRow(id: string): ChargeRow {
  return {
    id,
    type: 'CommonCharge',
    tags: [],
    suggestedTags: [],
    counts: { transactions: 0, documents: 0, ledger: 0, miscExpenses: 0 },
    missingInfo: [],
    accountantApproval: AccountantStatus.Unapproved,
  };
}

/** Mirrors the pagination options `ChargesTable` passes, so the rendered row count is asserted. */
function Probe({ rows, onCount }: { rows: ChargeRow[]; onCount: (n: number) => void }): ReactElement {
  const table = useTable({
    features: tableFeaturesConfig,
    data: rows,
    columns,
    getRowId: row => row.id,
    initialState: { pagination: { pageIndex: 0, pageSize: Number.MAX_SAFE_INTEGER } },
  });
  onCount(table.getRowModel().rows.length);
  return <div />;
}

async function renderedRowCount(rows: ChargeRow[]): Promise<number> {
  const container = document.createElement('div');
  document.body.append(container);
  let count = -1;
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(<Probe rows={rows} onCount={n => (count = n)} />);
    await Promise.resolve();
  });
  await act(async () => {
    root?.unmount();
    await Promise.resolve();
  });
  container.remove();
  return count;
}

describe('charges list pagination', () => {
  /**
   * `rowPaginationFeature` is registered in the shared feature set and `getRowModel()` ends in
   * pagination, so the list silently truncated: at the previous `pageSize: 100`, the two screens that
   * fetch without a limit (ledger validation streams; the VAT report sections are unbounded) could
   * never show anything past row 100. Leaving `pageSize` unset would be worse — tanstack defaults to 10.
   */
  it('renders every charge it is handed, past the old 100-row ceiling', async () => {
    const rows = Array.from({ length: 250 }, (_, i) => makeRow(`c${i}`));
    expect(await renderedRowCount(rows)).toBe(250);
  });

  it('renders an exactly-100 list unchanged', async () => {
    const rows = Array.from({ length: 100 }, (_, i) => makeRow(`c${i}`));
    expect(await renderedRowCount(rows)).toBe(100);
  });
});
