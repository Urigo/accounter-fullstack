'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ErrorBoundary } from 'react-error-boundary';
import { useQuery } from 'urql';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { SimilarChargesDocument } from '../../../gql/graphql.js';
import { useBatchUpdateCharges } from '../../../hooks/use-batch-update-charges.js';
import { Button } from '../../ui/button.jsx';
import { Card } from '../../ui/card.jsx';
import { Checkbox } from '../../ui/checkbox.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.jsx';
import { AccounterLoader } from '../index.js';

type Charge = {
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

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query SimilarCharges(
    $chargeId: UUID!
    $withMissingTags: Boolean!
    $withMissingDescription: Boolean!
  ) {
    similarCharges(
      chargeId: $chargeId
      withMissingTags: $withMissingTags
      withMissingDescription: $withMissingDescription
    ) {
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
  }
`;

const columns: ColumnDef<Charge>[] = [
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
    cell: ({ row }) => <div>{format(row.getValue('date'), 'yyyy-MM-dd')}</div>,
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
      const transactions: number = row.getValue('transactions') || 0;
      const documents: number = row.getValue('documents') || 0;
      const miscExpenses: number = row.getValue('miscExpenses') || 0;
      const ledgerRecords: number = row.getValue('ledgerRecords') || 0;
      return (
        <div className="flex flex-col justify-center">
          {transactions && <div>Transactions: {transactions}</div>}
          {documents && <div>Documents: {documents}</div>}
          {miscExpenses && <div>Misc Expenses: {miscExpenses}</div>}
          {ledgerRecords && <div>Ledger Records: {ledgerRecords}</div>}
        </div>
      );
    },
  },
];

function getChargeTypeName(chargeType: string): string {
  let type = 'Unknown';

  switch (chargeType) {
    case 'CommonCharge':
      type = 'Common';
      break;
    case 'BusinessTripCharge':
      type = 'Business Trip';
      break;
    case 'DividendCharge':
      type = 'Dividend';
      break;
    case 'ConversionCharge':
      type = 'Conversion';
      break;
    case 'SalaryCharge':
      type = 'Salary';
      break;
    case 'InternalTransferCharge':
      type = 'Internal Transfer';
      break;
    case 'MonthlyVatCharge':
      type = 'Monthly VAT';
      break;
    case 'BankDepositCharge':
      type = 'Bank Deposit';
      break;
    case 'CreditcardBankCharge':
      type = 'Credit Card Bank Charge';
      break;
    case 'FinancialCharge':
      type = 'Financial Charge';
      break;
  }
  return type;
}

export function SimilarChargesModal({
  chargeId,
  tagIds,
  description,
  open,
  onOpenChange,
  onClose,
}: {
  chargeId: string;
  tagIds?: { id: string }[];
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
}) {
  const [{ data, fetching }, fetchSimilarCharges] = useQuery({
    pause: true,
    query: SimilarChargesDocument,
    variables: {
      chargeId,
      withMissingTags: !!tagIds,
      withMissingDescription: !!description,
    },
  });

  useEffect(() => {
    if (open && (tagIds || description)) {
      fetchSimilarCharges();
    }
  }, [open, tagIds, description, fetchSimilarCharges, chargeId]);

  const onDialogChange = useCallback(
    (openState: boolean) => {
      onOpenChange(openState);
      if (open && !openState) {
        onClose?.();
      }
    },
    [onOpenChange, onClose, open],
  );

  const charges = useMemo((): Charge[] => {
    const charges: Charge[] =
      data?.similarCharges.map(c => ({
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
    if (data && charges.length === 0) {
      onDialogChange(false);
    }
    return charges;
  }, [data, onDialogChange]);

  return (
    <Dialog
      open={open && (!!tagIds || !!description) && charges.length > 0}
      onOpenChange={onDialogChange}
    >
      <DialogContent className="overflow-scroll max-h-screen w-full sm:max-w-[640px] md:max-w-[768px] lg:max-w-[900px]">
        <ErrorBoundary fallback={<div>Error fetching similar charges</div>}>
          {fetching ? (
            <AccounterLoader />
          ) : tagIds || description ? (
            <SimilarChargesTable
              data={charges}
              tagIds={tagIds}
              description={description}
              onOpenChange={onDialogChange}
            />
          ) : null}
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}

function SimilarChargesTable({
  data,
  tagIds,
  description,
  onOpenChange,
}: {
  data: Charge[];
  tagIds?: { id: string }[];
  description?: string;
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
    return;
  }

  return (
    <>
      <DialogHeader className="flex flex-row items-center justify-between">
        <DialogTitle>Charges</DialogTitle>
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
