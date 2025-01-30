'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { useQuery } from 'urql';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { SimilarTransactionsDocument } from '../../../gql/graphql.js';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction.js';
import { Button } from '../../ui/button.js';
import { Card } from '../../ui/card.js';
import { Checkbox } from '../../ui/checkbox.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { AccounterLoader } from '../index.js';

type Transaction = {
  id: string;
  amountRaw: number;
  amountFormatted: string;
  sourceDescription: string;
  eventDate: Date;
  effectiveDate?: Date;
  accountType: string;
  accountName: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query SimilarTransactions($transactionId: UUID!, $withMissingInfo: Boolean!) {
    similarTransactions(transactionId: $transactionId, withMissingInfo: $withMissingInfo) {
      id
      account {
        id
        name
        type
      }
      amount {
        formatted
        raw
      }
      effectiveDate
      eventDate
      sourceDescription
    }
  }
`;

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
    accessorKey: 'accountType',
    header: 'Account Type',
    cell: ({ row }) => <div>{row.getValue('accountType')}</div>,
  },
  {
    accessorKey: 'accountName',
    header: 'Account Name',
    cell: ({ row }) => <div>{row.getValue('accountName')}</div>,
  },
  {
    accessorKey: 'amountRaw',
    header: 'Amount',
    cell: ({ row }) => <div>{row.getValue('amountFormatted')}</div>,
  },
  {
    accessorKey: 'sourceDescription',
    header: 'Description',
    cell: ({ row }) => <div>{row.getValue('sourceDescription')}</div>,
  },
  {
    accessorKey: 'eventDate',
    header: 'Event Date',
    cell: ({ row }) => <div>{format(row.getValue('eventDate'), 'yyyy-MM-dd')}</div>,
  },
  {
    accessorKey: 'valueDate',
    header: 'Value Date',
    cell: ({ row }) => <div>{format(row.getValue('valueDate'), 'yyyy-MM-dd')}</div>,
  },
];

export function SimilarTransactionsModal({
  transactionId,
  counterpartyId,
  open,
  onOpenChange,
  onClose,
}: {
  transactionId: string;
  counterpartyId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
}) {
  const [{ data, fetching }, fetchSimilarTransactions] = useQuery({
    pause: true,
    query: SimilarTransactionsDocument,
    variables: {
      transactionId,
      withMissingInfo: true,
    },
  });

  useEffect(() => {
    if (open && counterpartyId) {
      fetchSimilarTransactions();
    }
  }, [open, counterpartyId, fetchSimilarTransactions]);

  function onDialogChange(open: boolean) {
    onOpenChange(open);
    if (!open) {
      onClose?.();
    }
  }

  const transactions = useMemo(
    () =>
      data?.similarTransactions.map(t => ({
        id: t.id,
        amountRaw: t.amount.raw,
        amountFormatted: t.amount.formatted,
        sourceDescription: t.sourceDescription,
        eventDate: new Date(t.eventDate),
        effectiveDate: t.effectiveDate ? new Date(t.effectiveDate) : undefined,
        accountType: t.account.type,
        accountName: t.account.name,
      })) ?? [],
    [data],
  );

  return (
    <Dialog open={open} onOpenChange={onDialogChange}>
      <DialogContent>
        {fetching ? (
          <AccounterLoader />
        ) : (
          <SimilarTransactionsTable
            data={transactions}
            counterpartyId={counterpartyId!}
            onOpenChange={onDialogChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SimilarTransactionsTable({
  data,
  counterpartyId,
  onOpenChange,
}: {
  data: Transaction[];
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

    await Promise.all(
      ids.map(id =>
        updateTransaction({
          transactionId: id,
          fields: {
            counterpartyId,
          },
        }),
      ),
    );

    onOpenChange(false);
  }, [updateTransaction, onOpenChange, table, counterpartyId]);

  if (!data.length) {
    setTimeout(() => {
      onOpenChange(false);
    }, 2000);
    return (
      <DialogHeader className="flex flex-row items-center justify-between">
        <DialogTitle>No similar transactions found</DialogTitle>
      </DialogHeader>
    );
  }

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
