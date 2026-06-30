import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { ROUTES } from '../../router/routes.js';
import { formatLocality, type BusinessRow } from './business-rows.js';

function formatDate(value: Date | null): string {
  return value ? format(value, 'dd/MM/yyyy') : '—';
}

export const columns: ColumnDef<BusinessRow>[] = [
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
