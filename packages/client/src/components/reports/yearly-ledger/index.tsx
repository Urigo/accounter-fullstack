import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { TimelessDateString } from 'packages/client/src/helpers/dates.js';
import { useQuery } from 'urql';
import { YearPickerInput } from '@mantine/dates';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { YearlyLedgerDocument, YearlyLedgerQuery } from '../../../gql/graphql.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PageLayout } from '../../layout/page-layout.js';
import { Button } from '../../ui/button.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { DownloadCSV } from './download-csv.js';
import { DataTablePagination } from './pagination.js';

// import { YearlyLedgerFilter } from './tax-report-filters.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query YearlyLedger($fromDate: TimelessDate!, $toDate: TimelessDate!) {
    ledgerRecordsByDates(fromDate: $fromDate, toDate: $toDate) {
      id
      invoiceDate
      valueDate
      description
      reference
      debitAccount1 {
        id
        name
      }
      debitAmount1 {
        raw
        formatted
      }
      localCurrencyDebitAmount1 {
        raw
        formatted
      }
      debitAccount2 {
        id
        name
      }
      debitAmount2 {
        raw
        formatted
      }
      localCurrencyDebitAmount2 {
        raw
        formatted
      }
      creditAccount1 {
        id
        name
      }
      creditAmount1 {
        raw
        formatted
      }
      localCurrencyCreditAmount1 {
        raw
        formatted
      }
      creditAccount2 {
        id
        name
      }
      creditAmount2 {
        raw
        formatted
      }
      localCurrencyCreditAmount2 {
        raw
        formatted
      }
      ...LedgerCsvFields
    }
  }
`;

const columns: ColumnDef<NonNullable<YearlyLedgerQuery['ledgerRecordsByDates']>[number]>[] = [
  {
    accessorKey: 'invoiceDate',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Invoice Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue('invoiceDate'));
      const formatted = format(date, 'yyyy-MM-dd');

      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'valueDate',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Value Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue('valueDate'));
      const formatted = format(date, 'yyyy-MM-dd');

      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'description',
    header: 'Description',
  },
  {
    accessorKey: 'reference',
    header: 'Reference',
  },
  {
    accessorKey: 'debitAccount1.name',
    header: 'Debit1 Account',
  },
  {
    accessorKey: 'debitAmount1.formatted',
    header: 'Debit1 Amount',
  },
  {
    accessorKey: 'localCurrencyDebitAmount1.formatted',
    header: 'Debit1 Amount (Local)',
  },
  {
    accessorKey: 'debitAccount2.name',
    header: 'Debit2 Account',
  },
  {
    accessorKey: 'debitAmount2.formatted',
    header: 'Debit2 Amount',
  },
  {
    accessorKey: 'localCurrencyDebitAmount2.formatted',
    header: 'Debit2 Amount (Local)',
  },
  {
    accessorKey: 'creditAccount1.name',
    header: 'Credit1 Account',
  },
  {
    accessorKey: 'creditAmount1.formatted',
    header: 'Credit1 Amount',
  },
  {
    accessorKey: 'localCurrencyCreditAmount1.formatted',
    header: 'Credit1 Amount (Local)',
  },
  {
    accessorKey: 'creditAccount2.name',
    header: 'Credit2 Account',
  },
  {
    accessorKey: 'creditAmount2.formatted',
    header: 'Credit2 Amount',
  },
  {
    accessorKey: 'localCurrencyCreditAmount2.formatted',
    header: 'Credit2 Amount (Local)',
  },
];

export const YearlyLedgerReport = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [year, setYear] = useState<number>(new Date().getFullYear() - 1);
  const [sorting, setSorting] = useState<SortingState>([]);

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: YearlyLedgerDocument,
    variables: {
      fromDate: `${year}-01-01` as TimelessDateString,
      toDate: `${year}-12-31` as TimelessDateString,
    },
  });

  const ledgerRecords = useMemo(() => data?.ledgerRecordsByDates ?? [], [data]);

  const table = useReactTable({
    data: ledgerRecords,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex items-center justify-end space-x-2 py-4">
        <YearPickerInput
          value={new Date(year, 0, 1)}
          onChange={date => date && setYear(date?.getFullYear())}
          popoverProps={{ withinPortal: true }}
          minDate={new Date(2010, 0, 1)}
          maxDate={new Date()}
        />
        <DownloadCSV data={ledgerRecords} year={year} />
      </div>,
    );
  }, [year, fetching, table, setFiltersContext, ledgerRecords]);

  return (
    <PageLayout title="Yearly Ledger Report">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <DataTablePagination table={table} />
          </div>
          {ledgerRecords && (
            <div className="rounded-md border">
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
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
};
