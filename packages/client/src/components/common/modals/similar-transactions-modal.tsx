'use client';

import React, { useCallback } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction.js';
import { Button } from '../../ui/button.js';
import { Card } from '../../ui/card.js';
import { Checkbox } from '../../ui/checkbox.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';

export type Transaction = {
  id: string;
  cardType: string;
  date: string;
  amount: number;
};

// TODO: load real txs
const data: Transaction[] = [
  {
    id: '1',
    cardType: 'Visa',
    date: '01-01-2000',
    amount: 100,
  },
  {
    id: '2',
    cardType: 'Visa',
    date: '08-01-2000',
    amount: 0.01,
  },
  {
    id: '3',
    cardType: 'Visa',
    date: '01-02-2000',
    amount: 100,
  },
  {
    id: '4',
    cardType: 'Visa',
    date: '01-01-2025',
    amount: 0.01,
  },
];

export const columns: ColumnDef<Transaction>[] = [
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
    accessorKey: 'cardType',
    header: 'Card Type',
    cell: ({ row }) => <div>{row.getValue('cardType')}</div>,
  },
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => <div>{row.getValue('date')}</div>,
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
      return <div>{formatted}</div>;
    },
  },
];

export function SimilarTransactionsModal({
  counterpartyId,
  open,
  onOpenChange,
}: {
  counterpartyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <SimilarTransactionsTable counterpartyId={counterpartyId} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function SimilarTransactionsTable({
  counterpartyId,
  onOpenChange,
}: {
  counterpartyId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
  });

  const { updateTransaction } = useUpdateTransaction();

  const onApproveSelected = useCallback(async () => {
    const ids = table.getSelectedRowModel().rows.map(row => row.original.id);

    for (const id of ids) {
      await updateTransaction({
        transactionId: id,
        fields: {
          counterpartyId,
        },
      });
    }

    onOpenChange(false);
  }, [updateTransaction, onOpenChange, table, counterpartyId]);

  return (
    <>
      <DialogHeader className="flex flex-row items-center justify-between">
        <DialogTitle>Transactions</DialogTitle>
        <Button onClick={onApproveSelected}>Approve selected</Button>
      </DialogHeader>
      <Card>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
