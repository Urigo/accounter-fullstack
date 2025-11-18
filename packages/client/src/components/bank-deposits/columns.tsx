import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { DepositTransactionFieldsFragment } from '../../gql/graphql.js';
import { Button } from '../ui/button.js';
import {
  Amount,
  CumulativeBalance,
  DateCell,
  DepositIndicator,
  LocalAmount,
  LocalCumulativeBalance,
} from './cells/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DepositTransactionFields on Transaction {
    id
    eventDate
    amount {
      raw
      formatted
      currency
    }
    currency
  }
`;

export type DepositTransactionRowType = DepositTransactionFieldsFragment & {
  cumulativeBalance: number;
  localCumulativeBalance: number;
  localAmount: number;
};

export const columns: ColumnDef<DepositTransactionRowType>[] = [
  {
    id: 'date',
    accessorKey: 'eventDate',
    sortingFn: row => {
      return row.original.eventDate ? new Date(row.original.eventDate).getTime() : 0;
    },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Date
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <DateCell transaction={row.original} />;
    },
  },
  {
    id: 'indicator',
    accessorKey: 'amount.raw',
    header: 'Type',
    cell: ({ row }) => {
      return <DepositIndicator transaction={row.original} />;
    },
  },
  {
    id: 'amount',
    accessorKey: 'amount.raw',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Origin Amount
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <Amount transaction={row.original} />;
    },
  },
  {
    id: 'cumulativeBalance',
    accessorKey: 'cumulativeBalance',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Origin Balance
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <CumulativeBalance transaction={row.original} />;
    },
  },
  {
    id: 'localAmount',
    accessorKey: 'localAmount',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Local Amount
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <LocalAmount transaction={row.original} />;
    },
  },
  {
    id: 'localCumulativeBalance',
    accessorKey: 'localCumulativeBalance',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Local Balance
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <LocalCumulativeBalance transaction={row.original} />;
    },
  },
];
