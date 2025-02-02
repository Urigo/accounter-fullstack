import { ReactElement } from 'react';
import { format } from 'date-fns';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  //   getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  YearlyLedgerReportTableFragment,
  YearlyLedgerReportTableFragmentDoc,
} from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';

// import { DataTablePagination } from './pagination.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment YearlyLedgerReportTable on YearlyLedgerReport {
    id
    year
    financialEntitiesInfo {
      entity {
        id
        name
        sortCode {
          id
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
  }
`;

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'ILS',
});

type Row = YearlyLedgerReportTableFragment['financialEntitiesInfo'][number]['records'][number] &
  Pick<
    YearlyLedgerReportTableFragment['financialEntitiesInfo'][number],
    'openingBalance' | 'closingBalance' | 'totalCredit' | 'totalDebit' | 'entity'
  >;

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: 'counterparty',
    header: 'Counterparty',
    cell: ({ row }) => {
      return <div className="font-medium">{row.original.counterParty?.name}</div>;
    },
  },
  {
    accessorKey: 'invoiceDate',
    header: 'Invoice Date',
    cell: ({ row }) => {
      const date = new Date(row.getValue('invoiceDate'));
      const formatted = format(date, 'yyyy-MM-dd');

      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'valueDate',
    header: 'Value Date',
    cell: ({ row }) => {
      const date = new Date(row.getValue('valueDate'));
      const formatted = format(date, 'yyyy-MM-dd');

      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'reference',
    header: 'Reference',
  },
  {
    accessorKey: 'description',
    header: 'Description',
  },
  {
    id: 'debit',
    accessorKey: 'amount',
    header: 'Debit',
    cell: ({ row }) => {
      const amount = row.original.amount.raw;

      return amount < 0 ? <div className="font-medium">{formatter.format(amount * -1)}</div> : null;
    },
  },
  {
    id: 'credit',
    accessorKey: 'amount',
    header: 'Credit',
    cell: ({ row }) => {
      const amount = row.original.amount.raw;

      return amount >= 0 ? <div className="font-medium">{formatter.format(amount)}</div> : null;
    },
  },
  {
    accessorKey: 'balance',
    header: 'Balance',
    cell: ({ row }) => (
      <div className="font-medium">{formatter.format(row.getValue('balance'))}</div>
    ),
  },
];

interface Props {
  data: FragmentType<typeof YearlyLedgerReportTableFragmentDoc>;
}

export const YearlyLedgerReportTable = ({ data }: Props): ReactElement => {
  const { financialEntitiesInfo } = getFragmentData(YearlyLedgerReportTableFragmentDoc, data);

  const table = useReactTable({
    data: financialEntitiesInfo
      .map(i => {
        const { entity, openingBalance, closingBalance, totalCredit, totalDebit } = i;
        const rows: Row[] = i.records.map(r => ({
          ...r,
          entity,
          openingBalance,
          closingBalance,
          totalCredit,
          totalDebit,
        }));
        return rows;
      })
      .flat(),
    columns,
    getCoreRowModel: getCoreRowModel(),
    // getPaginationRowModel: getPaginationRowModel(),
    // initialState: {
    //   pagination: {
    //     pageSize: 100,
    //   },
    // },
  });

  return (
    <div className="flex flex-col gap-4">
      {/* <div className="flex items-center justify-between px-2">
        <DataTablePagination table={table} />
      </div> */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                <TableHead />
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
                  {isFirstOfEntity && (
                    <>
                      <TableRow key={`${row.id}-opening1`}>
                        <TableCell>
                          <div className="font-medium">{row.original.entity.name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.original.entity.sortCode?.id}</div>
                        </TableCell>
                      </TableRow>
                      <TableRow key={`${row.id}-opening2`}>
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
                          <div className="font-medium">
                            {formatter.format(row.original.openingBalance.raw)}
                          </div>
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                  <TableRow key={row.id}>
                    <TableCell />
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {isLastOfEntity && (
                    <>
                      <TableRow key={`${row.id}-totals1`}>
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
                          <div className="font-medium">
                            {formatter.format(row.original.totalDebit.raw)} Debit
                          </div>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                      <TableRow key={`${row.id}-totals2`}>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell>
                          <div className="font-medium">
                            {formatter.format(row.original.totalCredit.raw)} Credit
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {formatter.format(row.original.closingBalance.raw)}
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow key={`${row.id}-totals3`}>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell>
                          <div className="font-medium">
                            {formatter.format(
                              row.original.totalCredit.raw - row.original.totalDebit.raw,
                            )}{' '}
                            Diff
                          </div>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
