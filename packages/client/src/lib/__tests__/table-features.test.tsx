import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useTable, type ColumnDef } from '@tanstack/react-table';
import { paginatedTableFeaturesConfig, tableFeaturesConfig } from '../table-features.js';

type Row = { id: number };

const data: Row[] = Array.from({ length: 25 }, (_, index) => ({ id: index }));

const columns: ColumnDef<typeof tableFeaturesConfig, Row>[] = [
  { id: 'id', accessorKey: 'id', header: 'Id' },
];
const paginatedColumns: ColumnDef<typeof paginatedTableFeaturesConfig, Row>[] = [
  { id: 'id', accessorKey: 'id', header: 'Id' },
];

let container: HTMLDivElement;
let root: Root;

/** Renders `probe` once and hands back whatever it read off its table. */
function render(probe: () => void): void {
  function Probe(): ReactElement {
    probe();
    return <div />;
  }
  act(() => {
    root.render(<Probe />);
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('tableFeaturesConfig', () => {
  it('renders every row when no page size is configured', () => {
    let rowCount = -1;
    render(() => {
      const table = useTable({ features: tableFeaturesConfig, data, columns });
      rowCount = table.getRowModel().rows.length;
    });

    // Regression guard. While the shared feature set registered `paginatedRowModel`, this was 10:
    // TanStack's default page size, inherited by every table that forgot `initialState.pagination`
    // — which silently hid rows 11+ in the VAT report and eight other tables that render no
    // pagination control.
    expect(rowCount).toBe(25);
  });

  it('renders every row for an empty data set without throwing', () => {
    let rowCount = -1;
    render(() => {
      const table = useTable({ features: tableFeaturesConfig, data: [], columns });
      rowCount = table.getRowModel().rows.length;
    });

    expect(rowCount).toBe(0);
  });
});

describe('paginatedTableFeaturesConfig', () => {
  it('pages when a table opts in', () => {
    let rowCount = -1;
    let pageCount = -1;
    render(() => {
      const table = useTable({
        features: paginatedTableFeaturesConfig,
        data,
        columns: paginatedColumns,
        initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
      });
      rowCount = table.getRowModel().rows.length;
      pageCount = table.getPageCount();
    });

    expect(rowCount).toBe(10);
    expect(pageCount).toBe(3);
  });

  it('exposes the pagination API the shared pagination bar calls', () => {
    let canNext = false;
    let pageSize = -1;
    render(() => {
      const table = useTable({
        features: paginatedTableFeaturesConfig,
        data,
        columns: paginatedColumns,
        initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
      });
      canNext = table.getCanNextPage();
      pageSize = table.state.pagination.pageSize;
    });

    expect(canNext).toBe(true);
    expect(pageSize).toBe(10);
  });
});
