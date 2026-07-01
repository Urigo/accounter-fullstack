import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { ROUTES } from '../../router/routes.js';
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
];
