import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { type ColumnDef, type VisibilityState } from '@tanstack/react-table';
import { ROUTES } from '../../router/routes.js';
import { Badge } from '../ui/badge.js';
import { Checkbox } from '../ui/checkbox.js';
import { formatLocality, type BusinessRow } from './business-rows.js';

function formatDate(value: Date | null): string {
  return value ? format(value, 'dd/MM/yyyy') : '—';
}

export const columns: ColumnDef<BusinessRow>[] = [
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
    header: 'Name',
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
    header: 'Locality',
    cell: ({ row }) => formatLocality(row.original) || '—',
  },
  {
    accessorKey: 'governmentId',
    header: 'VAT number',
    cell: ({ row }) => row.original.governmentId ?? '—',
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    accessorKey: 'updatedAt',
    header: 'Updated',
    cell: ({ row }) => formatDate(row.original.updatedAt),
  },
  // Categorization
  {
    id: 'sortCode',
    header: 'Sort code',
    cell: ({ row }) => row.original.sortCodeKey ?? '—',
  },
  {
    id: 'taxCategory',
    header: 'Tax category',
    cell: ({ row }) => row.original.taxCategoryName ?? '—',
  },
  {
    id: 'irsCode',
    header: 'IRS code',
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
];

// Categorization and Suggestion-defaults columns are hidden by default; Core, Main and
// Extension tags are shown.
export const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  sortCode: false,
  taxCategory: false,
  irsCode: false,
  pcn874RecordType: false,
  description: false,
  tags: false,
};
