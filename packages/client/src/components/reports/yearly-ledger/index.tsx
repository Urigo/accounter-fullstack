import { useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { YearPickerInput } from '@mantine/dates';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table';
import { Currency, YearlyLedgerDocument, type YearlyLedgerQuery } from '../../../gql/graphql.js';
import { getCurrencyFormatter } from '../../../helpers/index.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { DataTablePagination } from '../../common/index.js';
import { PageLayout } from '../../layout/page-layout.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { DownloadCSV } from './download-csv.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query YearlyLedger($year: Int!) {
    yearlyLedgerReport(year: $year) {
      id
      year
      financialEntitiesInfo {
        entity {
          id
          name
          sortCode {
            id
            key
          }
        }
        openingBalance {
          raw
        }
        totalCredit {
          raw
        }
        totalDebit {
          raw
        }
        closingBalance {
          raw
        }
        records {
          id
          amount {
            raw
            formatted
          }
          invoiceDate
          valueDate
          description
          reference
          counterParty {
            id
            name
          }
          balance
        }
      }
      ...LedgerCsvFields
    }
  }
`;

const formatter = getCurrencyFormatter(Currency.Ils);

type RowType =
  YearlyLedgerQuery['yearlyLedgerReport']['financialEntitiesInfo'][number]['records'][number] &
    Pick<
      YearlyLedgerQuery['yearlyLedgerReport']['financialEntitiesInfo'][number],
      'openingBalance' | 'closingBalance' | 'totalCredit' | 'totalDebit' | 'entity'
    >;

const columns: ColumnDef<RowType>[] = [
  {
    id: 'placeholder',
    header: '',
    cell: () => null,
  },
  {
    id: 'counterparty',
    accessorKey: 'counterparty',
    header: 'Counterparty',
    cell: ({ row }) => {
      return <div className="font-medium">{row.original.counterParty?.name}</div>;
    },
  },
  {
    id: 'invoiceDate',
    accessorKey: 'invoiceDate',
    header: 'Invoice Date',
    cell: ({ row }) => {
      const date = new Date(row.getValue('invoiceDate'));
      const formatted = format(date, 'yyyy-MM-dd');

      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    id: 'valueDate',
    accessorKey: 'valueDate',
    header: 'Value Date',
    cell: ({ row }) => {
      const date = new Date(row.getValue('valueDate'));
      const formatted = format(date, 'yyyy-MM-dd');

      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    id: 'reference',
    accessorKey: 'reference',
    header: 'Reference',
  },
  {
    id: 'description',
    accessorKey: 'description',
    header: 'Description',
  },
  {
    id: 'debit',
    header: 'Debit',
    cell: ({ row }) => {
      const amount = row.original.amount.raw;

      return amount < 0 ? <div className="font-medium">{formatter.format(amount * -1)}</div> : null;
    },
  },
  {
    id: 'credit',
    header: 'Credit',
    cell: ({ row }) => {
      const amount = row.original.amount.raw;

      return amount >= 0 ? <div className="font-medium">{formatter.format(amount)}</div> : null;
    },
  },
  {
    id: 'balance',
    accessorKey: 'balance',
    header: 'Balance',
    cell: ({ row }) => (
      <div className="font-medium">{formatter.format(row.getValue('balance'))}</div>
    ),
  },
];

export const YearlyLedgerReport = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [year, setYear] = useState<number>(new Date().getFullYear() - 1);

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: YearlyLedgerDocument,
    variables: {
      year,
    },
  });

  const reportData = data?.yearlyLedgerReport;
  const { financialEntitiesInfo } = reportData ?? {};

  const records = useMemo(() => {
    return (
      financialEntitiesInfo?.flatMap(i => {
        const { entity, openingBalance, closingBalance, totalCredit, totalDebit } = i;
        const rows: RowType[] = i.records.map(r => ({
          entity,
          openingBalance,
          closingBalance,
          totalCredit,
          totalDebit,
          ...r,
        }));
        return rows;
      }) ?? []
    );
  }, [financialEntitiesInfo]);

  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 100,
      },
    },
  });

  const currentPage = table.getState().pagination.pageIndex;

  useEffect(() => {
    setFiltersContext(
      <div className="flex items-center justify-end gap-10 space-x-2 py-4">
        <div className="flex items-center justify-between px-2">
          <DataTablePagination table={table} />
        </div>
        <div className="flex items-center justify-end gap-2">
          <YearPickerInput
            value={new Date(year, 0, 1)}
            onChange={date => date && setYear(date?.getFullYear())}
            popoverProps={{ withinPortal: true }}
            minDate={new Date(2010, 0, 1)}
            maxDate={new Date()}
          />
          <DownloadCSV data={reportData} year={year} />
        </div>
      </div>,
    );
  }, [year, fetching, setFiltersContext, reportData, table, currentPage]);

  return (
    <PageLayout title="Yearly Ledger Report">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : reportData ? (
        <div className="flex flex-col gap-4 rounded-md border">
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
              {table.getRowModel().rows.map((row, i) => {
                const prevRow = table.getRowModel().rows[i - 1];
                const nextRow = table.getRowModel().rows[i + 1];
                const isFirstOfEntity =
                  !prevRow || prevRow.original.entity.id !== row.original.entity.id;
                const isLastOfEntity =
                  !nextRow || nextRow.original.entity.id !== row.original.entity.id;
                return (
                  <>
                    {isFirstOfEntity && i !== 0 && (
                      <TableRow className="border-y-2 border-t-gray-300 border-b-gray-500">
                        <TableCell />
                      </TableRow>
                    )}
                    {isFirstOfEntity && <EntityOpeningRows row={row} />}
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isLastOfEntity && <EntityClosingRows row={row} />}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-md border h-24 text-center">No results.</div>
      )}
    </PageLayout>
  );
};

function EntityOpeningRows({ row }: { row: Row<RowType> }) {
  return (
    <>
      <TableRow key={`${row.id}-opening1`} className="bg-gray-300">
        <TableCell>
          <div className="font-medium">{row.original.entity.name}</div>
        </TableCell>
        <TableCell>
          <div className="font-medium">{row.original.entity.sortCode?.key}</div>
        </TableCell>
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
      </TableRow>
      <TableRow key={`${row.id}-opening2`} className="bg-gray-200">
        <TableCell />
        <TableCell>
          <div className="font-medium">Opening Balance</div>
        </TableCell>
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell>
          <div className="font-medium">{formatter.format(row.original.openingBalance.raw)}</div>
        </TableCell>
      </TableRow>
    </>
  );
}

function EntityClosingRows({ row }: { row: Row<RowType> }) {
  return (
    <>
      <TableRow key={`${row.id}-totals1`} className="bg-gray-200">
        <TableCell>
          <div className="font-medium">Total</div>
        </TableCell>
        <TableCell>
          <div className="font-medium">{row.original.entity.name}</div>
        </TableCell>
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell>
          <div className="font-medium">{formatter.format(row.original.totalDebit.raw)} Debit</div>
        </TableCell>
        <TableCell />
      </TableRow>
      <TableRow key={`${row.id}-totals2`} className="bg-gray-200">
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell>
          <div className="font-medium">{formatter.format(row.original.totalCredit.raw)} Credit</div>
        </TableCell>
        <TableCell>
          <div className="font-medium">{formatter.format(row.original.closingBalance.raw)}</div>
        </TableCell>
      </TableRow>
      <TableRow key={`${row.id}-totals3`} className="bg-gray-200">
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell>
          <div className="font-medium">
            {formatter.format(row.original.totalCredit.raw - row.original.totalDebit.raw)} Diff
          </div>
        </TableCell>
        <TableCell />
      </TableRow>
    </>
  );
}
