'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ErrorBoundary } from 'react-error-boundary';
import { useQuery } from 'urql';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { SimilarTransactionsDocument } from '../../../gql/graphql.js';
import { useUpdateTransactions } from '../../../hooks/use-update-transactions.js';
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
  valueDate?: Date;
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

const columns: ColumnDef<Transaction>[] = [
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
    header: 'Type',
    cell: ({ row }) => <div>{row.getValue('accountType')}</div>,
  },
  {
    accessorKey: 'accountName',
    header: 'Account',
    cell: ({ row }) => <div>{row.getValue('accountName')}</div>,
  },
  {
    accessorKey: 'amountRaw',
    header: 'Amount',
    cell: ({ row }) => <div>{row.original.amountFormatted}</div>,
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
    cell: ({ row }) => (
      <div>{row.getValue('valueDate') ? format(row.getValue('valueDate'), 'yyyy-MM-dd') : ''}</div>
    ),
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
  }, [open, counterpartyId, fetchSimilarTransactions, transactionId]);

  const onDialogChange = useCallback(
    (openState: boolean) => {
      onOpenChange(openState);
      if (open && !openState) {
        onClose?.();
      }
    },
    [onOpenChange, onClose, open],
  );

  const transactions = useMemo(() => {
    const transactions =
      data?.similarTransactions.map(t => ({
        id: t.id,
        amountRaw: t.amount.raw,
        amountFormatted: t.amount.formatted,
        sourceDescription: t.sourceDescription,
        eventDate: new Date(t.eventDate),
        valueDate: t.effectiveDate ? new Date(t.effectiveDate) : undefined,
        accountType: t.account.type,
        accountName: t.account.name,
      })) ?? [];
    if (data && transactions.length === 0) {
      onDialogChange(false);
    }
    return transactions;
  }, [data, onDialogChange]);

  return (
    <Dialog
      open={open && !!counterpartyId && transactions.length > 0}
      onOpenChange={onDialogChange}
    >
      <DialogContent className="overflow-scroll max-h-screen w-full sm:max-w-[640px] md:max-w-[768px] lg:max-w-[900px]">
        <ErrorBoundary fallback={<div>Error fetching similar transactions</div>}>
          {fetching ? (
            <AccounterLoader />
          ) : counterpartyId ? (
            <SimilarTransactionsTable
              data={transactions}
              counterpartyId={counterpartyId}
              onOpenChange={onDialogChange}
            />
          ) : null}
        </ErrorBoundary>
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

  const { updateTransactions } = useUpdateTransactions();

  const onApproveSelected = useCallback(async () => {
    const ids = table.getSelectedRowModel().rows.map(row => row.original.id);

    // Avoid overloading the server with Promise.all
    await updateTransactions({
      transactionIds: ids,
      fields: {
        counterpartyId,
      },
    });

    onOpenChange(false);
  }, [updateTransactions, onOpenChange, table, counterpartyId]);

  useEffect(() => {
    if (data.length === 0) {
      onOpenChange(false);
    }
  }, [data.length, onOpenChange]);

  if (!data.length) {
    return null;
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
            {table.getRowModel().rows.map(row => (
              <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
