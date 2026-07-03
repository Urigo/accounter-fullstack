import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { type ColumnDef, type Row, type Table, type VisibilityState } from '@tanstack/react-table';
import { ROUTES } from '../../router/routes.js';
import { DataTableColumnHeader } from '../common/data-table-column-header.js';
import { Badge } from '../ui/badge.js';
import { Checkbox } from '../ui/checkbox.js';
import { BusinessRowActions } from './business-row-actions.js';
import { formatLocality, type BusinessTableMeta, type BusinessTableRow } from './business-rows.js';

function formatDate(value: Date | null): string {
  // A failed `new Date(...)` parse yields an Invalid Date (truthy), which makes date-fns `format`
  // throw a RangeError and crash the row — guard on the timestamp being a real number.
  return value && !Number.isNaN(value.getTime()) ? format(value, 'dd/MM/yyyy') : '—';
}

/** Null-safe date sort comparator (missing dates sort first ascending). */
function sortByDate(field: 'createdAt' | 'updatedAt') {
  return (a: Row<BusinessTableRow>, b: Row<BusinessTableRow>) =>
    (a.original[field]?.getTime() ?? 0) - (b.original[field]?.getTime() ?? 0);
}

/** Usage cells show the count, a spinner while the lazy usage query is in flight, or a dash. */
function usageCell(value: number | null, table: Table<BusinessTableRow>) {
  if (value != null) {
    return value;
  }
  const meta = table.options.meta as BusinessTableMeta | undefined;
  return meta?.usageFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : '—';
}

export const columns: ColumnDef<BusinessTableRow>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={value => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => {
      const { id, name, hebrewName } = row.original;
      return (
        <Link
          to={ROUTES.BUSINESSES.DETAIL(id)}
          state={{ from: ROUTES.BUSINESSES.ALL }}
          className="font-medium text-blue-600 hover:underline"
        >
          {name}
          {hebrewName ? (
            <span className="block text-xs text-muted-foreground">{hebrewName}</span>
          ) : null}
        </Link>
      );
    },
  },
  {
    id: 'locality',
    accessorFn: row => formatLocality(row),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Locality" />,
    cell: ({ row }) => formatLocality(row.original) || '—',
  },
  {
    accessorKey: 'governmentId',
    header: ({ column }) => <DataTableColumnHeader column={column} title="VAT number" />,
    cell: ({ row }) => row.original.governmentId ?? '—',
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
    sortingFn: sortByDate('createdAt'),
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    accessorKey: 'updatedAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Updated" />,
    sortingFn: sortByDate('updatedAt'),
    cell: ({ row }) => formatDate(row.original.updatedAt),
  },
  // Categorization
  {
    id: 'sortCode',
    accessorFn: row => row.sortCodeKey,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Sort code" />,
    cell: ({ row }) => {
      const { sortCodeKey, sortCodeName } = row.original;
      if (sortCodeKey == null && !sortCodeName) {
        return '—';
      }
      return (
        <div className="flex flex-col leading-tight">
          {sortCodeKey != null && <span className="font-medium">{sortCodeKey}</span>}
          {sortCodeName && <span className="text-xs text-muted-foreground">{sortCodeName}</span>}
        </div>
      );
    },
  },
  {
    id: 'taxCategory',
    header: 'Tax category',
    cell: ({ row }) => row.original.taxCategoryName ?? '—',
  },
  {
    id: 'irsCode',
    accessorFn: row => row.irsCode,
    header: ({ column }) => <DataTableColumnHeader column={column} title="IRS code" />,
    cell: ({ row }) => row.original.irsCode ?? '—',
  },
  {
    id: 'pcn874RecordType',
    header: 'PCN874 type',
    cell: ({ row }) => row.original.pcn874RecordType ?? '—',
  },
  // Extension tags
  {
    id: 'isClient',
    header: 'Client',
    cell: ({ row }) => (row.original.isClient ? <Badge variant="outline">Client</Badge> : '—'),
  },
  {
    id: 'isAdmin',
    header: 'Admin',
    cell: ({ row }) => (row.original.isAdmin ? <Badge variant="outline">Admin</Badge> : '—'),
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) =>
      row.original.isActive ? (
        <Badge variant="secondary">Active</Badge>
      ) : (
        <Badge variant="destructive">Inactive</Badge>
      ),
  },
  // Suggestion defaults
  {
    id: 'description',
    header: 'Description',
    cell: ({ row }) => row.original.suggestionDescription ?? '—',
  },
  {
    id: 'tags',
    header: 'Tags',
    cell: ({ row }) =>
      row.original.suggestionTags.length ? (
        <div className="flex flex-wrap gap-1">
          {row.original.suggestionTags.map(tag => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      ) : (
        '—'
      ),
  },
  // Usage (lazy)
  {
    accessorKey: 'totalTransactions',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Transactions" />,
    cell: ({ row, table }) => usageCell(row.original.totalTransactions, table),
  },
  {
    accessorKey: 'totalDocuments',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Documents" />,
    cell: ({ row, table }) => usageCell(row.original.totalDocuments, table),
  },
  {
    accessorKey: 'totalMiscExpenses',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Misc expenses" />,
    cell: ({ row, table }) => usageCell(row.original.totalMiscExpenses, table),
  },
  {
    accessorKey: 'totalLedgerRecords',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ledger records" />,
    cell: ({ row, table }) => usageCell(row.original.totalLedgerRecords, table),
  },
  {
    id: 'actions',
    enableHiding: false,
    enableSorting: false,
    cell: ({ row, table }) => <BusinessRowActions row={row.original} table={table} />,
  },
];

/** Usage column ids — the lazy group that triggers the usage query when enabled. */
export const USAGE_COLUMN_IDS = [
  'totalTransactions',
  'totalDocuments',
  'totalMiscExpenses',
  'totalLedgerRecords',
];

/** Column groups, used by the column-visibility toggle. */
export const COLUMN_GROUPS: { label: string; columns: { id: string; label: string }[] }[] = [
  { label: 'Core', columns: [{ id: 'name', label: 'Name' }] },
  {
    label: 'Main',
    columns: [
      { id: 'locality', label: 'Locality' },
      { id: 'governmentId', label: 'VAT number' },
      { id: 'createdAt', label: 'Created' },
      { id: 'updatedAt', label: 'Updated' },
    ],
  },
  {
    label: 'Categorization',
    columns: [
      { id: 'sortCode', label: 'Sort code' },
      { id: 'taxCategory', label: 'Tax category' },
      { id: 'irsCode', label: 'IRS code' },
      { id: 'pcn874RecordType', label: 'PCN874 type' },
    ],
  },
  {
    label: 'Extension tags',
    columns: [
      { id: 'isClient', label: 'Client' },
      { id: 'isAdmin', label: 'Admin' },
      { id: 'status', label: 'Status' },
    ],
  },
  {
    label: 'Suggestion defaults',
    columns: [
      { id: 'description', label: 'Description' },
      { id: 'tags', label: 'Tags' },
    ],
  },
  {
    label: 'Usage',
    columns: [
      { id: 'totalTransactions', label: 'Transactions' },
      { id: 'totalDocuments', label: 'Documents' },
      { id: 'totalMiscExpenses', label: 'Misc expenses' },
      { id: 'totalLedgerRecords', label: 'Ledger records' },
    ],
  },
];

// Categorization, Suggestion-defaults and Usage columns are hidden by default; Core, Main
// and Extension tags are shown.
export const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  sortCode: false,
  taxCategory: false,
  irsCode: false,
  pcn874RecordType: false,
  description: false,
  tags: false,
  totalTransactions: false,
  totalDocuments: false,
  totalMiscExpenses: false,
  totalLedgerRecords: false,
};
