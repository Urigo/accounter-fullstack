'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { FragmentType, getFragmentData } from '../../../../gql/fragment-masking.js';
import { SimilarChargesTableFragmentDoc } from '../../../../gql/graphql.js';
import { getChargeTypeName } from '../../../../helpers/index.js';
import { useBatchUpdateCharges } from '../../../../hooks/use-batch-update-charges.js';
import { Button } from '../../../ui/button.js';
import { Card } from '../../../ui/card.js';
import { Checkbox } from '../../../ui/checkbox.js';
import { DialogHeader, DialogTitle } from '../../../ui/dialog.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SimilarChargesTable on Charge {
    id
    __typename
    counterparty {
      name
      id
    }
    minEventDate
    minDebitDate
    minDocumentsDate
    totalAmount {
      raw
      formatted
    }
    vat {
      raw
      formatted
    }
    userDescription
    tags {
      id
      name
    }
    taxCategory {
      id
      name
    }
    ... on BusinessTripCharge {
      businessTrip {
        id
        name
      }
    }
    metadata {
      transactionsCount
      documentsCount
      ledgerCount
      miscExpensesCount
    }
  }
`;

export type SimilarCharge = {
  id: string;
  chargeType: string;
  counterpartyName?: string;
  date?: Date;
  amountRaw?: number;
  amountFormatted?: string;
  vatAmountRaw?: number;
  vatAmountFormatted?: string;
  description?: string;
  tags: string[];
  taxCategoryName?: string;
  businessTripName?: string;
  ledgerRecords: number;
  documents: number;
  transactions: number;
  miscExpenses: number;
};

const columns: ColumnDef<SimilarCharge>[] = [
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
    accessorKey: 'chargeType',
    header: 'Type',
    cell: ({ row }) => <div>{row.getValue('chargeType')}</div>,
  },
  {
    accessorKey: 'counterpartyName',
    header: 'Counterparty',
    cell: ({ row }) => <div>{row.getValue('counterpartyName')}</div>,
  },
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => {
      const date = row.getValue('date') as Date | undefined;
      return <div>{date ? format(new Date(date), 'yyyy-MM-dd') : 'Missing'}</div>;
    },
  },
  {
    accessorKey: 'amountRaw',
    header: 'Amount',
    cell: ({ row }) => <div>{row.original.amountFormatted}</div>,
  },
  {
    accessorKey: 'vatAmountRaw',
    header: 'VAT Amount',
    cell: ({ row }) => <div>{row.original.vatAmountFormatted}</div>,
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => <div>{row.getValue('description')}</div>,
  },
  {
    accessorKey: 'taxCategoryName',
    header: 'Tax Category',
    cell: ({ row }) => <div>{row.getValue('taxCategoryName')}</div>,
  },
  {
    accessorKey: 'tags',
    header: 'Tags',
    cell: ({ row }) => {
      const tagsValue = row.getValue('tags');
      if (!tagsValue || !Array.isArray(tagsValue) || tagsValue.length === 0) {
        return <div>No tags</div>;
      }
      return <div>{tagsValue.join(' | ')}</div>;
    },
  },
  {
    accessorKey: 'businessTripName',
    header: 'Business Trip',
    cell: ({ row }) => <div>{row.getValue('businessTripName')}</div>,
  },
  {
    accessorKey: 'moreInfo',
    header: 'More Info',
    cell: ({ row }) => {
      const transactions: number = row.original.transactions || 0;
      const documents: number = row.original.documents || 0;
      const miscExpenses: number = row.original.miscExpenses || 0;
      const ledgerRecords: number = row.original.ledgerRecords || 0;
      return (
        <div className="flex flex-col justify-center text-sm">
          {transactions > 0 && <div>Transactions: {transactions}</div>}
          {documents > 0 && <div>Documents: {documents}</div>}
          {miscExpenses > 0 && <div>Misc Expenses: {miscExpenses}</div>}
          {ledgerRecords > 0 && <div>Ledger Records: {ledgerRecords}</div>}
        </div>
      );
    },
    enableSorting: false,
  },
];

export function SimilarChargesTable({
  data,
  tagIds,
  description,
  onOpenChange,
  title = 'Similar Charges',
}: {
  data: FragmentType<typeof SimilarChargesTableFragmentDoc>[];
  tagIds?: { id: string }[];
  description?: string;
  onOpenChange: (open: boolean) => void;
  title?: string;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState({});

  const similarCharges = useMemo(
    () => data.map(charge => getFragmentData(SimilarChargesTableFragmentDoc, charge)),
    [data],
  );

  const charges = useMemo((): SimilarCharge[] => {
    const charges: SimilarCharge[] =
      similarCharges.map(c => ({
        id: c.id,
        chargeType: getChargeTypeName(c.__typename),
        counterpartyName: c.counterparty?.name,
        date: c.minEventDate || c.minDebitDate || c.minDocumentsDate || undefined,
        amountRaw: c.totalAmount?.raw,
        amountFormatted: c.totalAmount?.formatted,
        vatAmountRaw: c.vat?.raw,
        vatAmountFormatted: c.vat?.formatted,
        description: c.userDescription || undefined,
        tags: c.tags.map(tag => tag.name),
        taxCategoryName: c.taxCategory?.name,
        businessTripName: c.__typename === 'BusinessTripCharge' ? c.businessTrip?.name : undefined,
        ledgerRecords: c.metadata?.ledgerCount ?? 0,
        documents: c.metadata?.documentsCount ?? 0,
        transactions: c.metadata?.transactionsCount ?? 0,
        miscExpenses: c.metadata?.miscExpensesCount ?? 0,
      })) ?? [];
    return charges;
  }, [similarCharges]);

  useEffect(() => {
    if (data && charges.length === 0) {
      onOpenChange(false);
    }
  }, [data, charges.length, onOpenChange]);

  const table = useReactTable({
    data: charges,
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

  const { batchUpdateCharges } = useBatchUpdateCharges();

  const onApproveSelected = useCallback(async () => {
    const ids = table.getSelectedRowModel().rows.map(row => row.original.id);

    await batchUpdateCharges({
      chargeIds: ids,
      fields: {
        ...(tagIds ? { tags: tagIds } : {}),
        ...(description ? { userDescription: description } : {}),
      },
    });

    onOpenChange(false);
  }, [batchUpdateCharges, onOpenChange, table, tagIds, description]);

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
        <DialogTitle>{title}</DialogTitle>
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
