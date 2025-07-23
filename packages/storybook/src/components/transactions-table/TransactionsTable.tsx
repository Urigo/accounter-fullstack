import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Edit2, ExternalLink } from 'lucide-react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '../ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import {
  AccountCell,
  AmountCell,
  CounterpartyCell,
  DebitDateCell,
  DescriptionCell,
  EventDateCell,
  SourceIdCell,
} from './cells';
import { TransactionsTableProps, TransactionsTableRowType } from './types';

// Create columns definition
const createColumns = (): ColumnDef<TransactionsTableRowType>[] => [
  {
    accessorKey: 'counterparty.name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Counterparty
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <CounterpartyCell transaction={row.original} />,
  },
  {
    accessorKey: 'eventDate',
    sortingFn: (rowA, rowB) => {
      const dateA = rowA.original.eventDate ? new Date(rowA.original.eventDate).getTime() : 0;
      const dateB = rowB.original.eventDate ? new Date(rowB.original.eventDate).getTime() : 0;
      return dateA - dateB;
    },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Event Date
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <EventDateCell transaction={row.original} />,
  },
  {
    accessorKey: 'effectiveDate',
    sortingFn: (rowA, rowB) => {
      const dateA = rowA.original.effectiveDate
        ? new Date(rowA.original.effectiveDate).getTime()
        : 0;
      const dateB = rowB.original.effectiveDate
        ? new Date(rowB.original.effectiveDate).getTime()
        : 0;
      return dateA - dateB;
    },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Debit Date
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <DebitDateCell transaction={row.original} />,
  },
  {
    accessorKey: 'amount.raw',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Amount
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <AmountCell transaction={row.original} />,
  },
  {
    accessorKey: 'account.name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Account
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <AccountCell transaction={row.original} />,
  },
  {
    accessorKey: 'sourceDescription',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Description
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <DescriptionCell transaction={row.original} />,
  },
  {
    accessorKey: 'referenceKey',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Reference#
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <SourceIdCell transaction={row.original} />,
  },
  {
    accessorKey: 'id',
    header: ({ table }) => {
      const rows = table.getCenterRows();
      if (!rows.length) return null;
      const row = rows[0];
      const { enableEdit, enableChargeLink } = row.original;

      return (
        <div className="text-center">
          {enableEdit && enableChargeLink
            ? 'Actions'
            : enableEdit
              ? 'Edit'
              : enableChargeLink
                ? 'Charge'
                : ''}
        </div>
      );
    },
    cell: ({ row }) => {
      const { enableEdit, enableChargeLink, editTransaction, chargeId } = row.original;

      return (
        <div className="flex gap-1 justify-center">
          {enableEdit && (
            <Button variant="ghost" size="icon" onClick={editTransaction} className="h-8 w-8">
              <Edit2 className="h-4 w-4" />
            </Button>
          )}

          {enableChargeLink && chargeId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => console.log('Navigate to charge:', chargeId)}
              className="h-8 w-8"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      );
    },
  },
];

export const TransactionsTable: React.FC<TransactionsTableProps> = ({
  data,
  enableEdit = false,
  enableChargeLink = false,
  onChange,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  // Add default props to data
  const enhancedData = data.map(transaction => ({
    ...transaction,
    enableEdit: transaction.enableEdit ?? enableEdit,
    enableChargeLink: transaction.enableChargeLink ?? enableChargeLink,
  }));

  const columns = createColumns();

  const table = useReactTable({
    data: enhancedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map(row => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No transactions found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
