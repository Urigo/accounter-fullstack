import type { ColumnDef } from '@tanstack/react-table';
import type { TableFeaturesConfig } from '@/lib/table-features.js';
import type { ChargeRow } from './charges-table.js';

/**
 * Accessor-only column definitions — a **sort schema**, not a description of a layout.
 *
 * The charges list has no header row and no cells: `ChargeRecord` reads `row.original` directly. But
 * `columns` is a required table option, and `column_getCanSort` needs a resolved accessor, so a field
 * is sortable only if it appears here. `header` and `cell` are both optional in v9, so these carry
 * neither.
 *
 * The `id`s are declared rather than derived. Left to itself tanstack names a column after its
 * accessor path with dots replaced — `counterparty_counterparty_name` — which the toolbar's sort menu
 * would then have to hardcode.
 */
export const columns: ColumnDef<TableFeaturesConfig, ChargeRow>[] = [
  { id: 'type', accessorKey: 'type' },
  {
    id: 'date',
    // Sort on the primitive `Date`, not the `ChargeDates` object. When this was `accessorKey: 'date'`
    // the accessor yielded that object, tanstack's `auto` sort matched neither Date nor string and
    // fell through to `sortFn_basic`, which compares `"[object Object]"` against itself and returns
    // -1 for every pair — so the Date column never actually sorted.
    accessorFn: row => row.dates?.date,
  },
  {
    id: 'amount',
    accessorFn: row => row.amount?.value,
    // Order by magnitude, so income and expenses of similar size sit together.
    sortFn: (rowA, rowB) =>
      Math.abs(rowA.original.amount?.value ?? 0) - Math.abs(rowB.original.amount?.value ?? 0),
  },
  { id: 'vat', accessorFn: row => row.vat?.value },
  { id: 'counterparty', accessorFn: row => row.counterparty?.name },
  { id: 'description', accessorFn: row => row.description },
  { id: 'taxCategory', accessorFn: row => row.taxCategory?.name },
  { id: 'businessTrip', accessorFn: row => row.businessTrip?.name },
];
