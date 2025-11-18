import { useMemo, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { DepositTransactionsDocument } from '../../gql/graphql.js';
import { getFragmentData } from '../../gql/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import {
  columns,
  DepositTransactionFieldsFragmentDoc,
  type DepositTransactionRowType,
} from './columns.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query DepositTransactions($depositId: String!) {
    deposit(depositId: $depositId) {
      id
      currency
      transactions {
        id
        ...DepositTransactionFields
      }
    }
  }
`;

type Props = {
  depositId: string;
};

export function DepositsTransactionsTable({ depositId }: Props): ReactElement {
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: 'date',
      desc: false,
    },
  ]);

  const [{ data, fetching }] = useQuery({
    query: DepositTransactionsDocument,
    variables: {
      depositId,
    },
  });

  const tableData: DepositTransactionRowType[] = useMemo(() => {
    if (!data?.deposit?.transactions) {
      return [];
    }

    const transactions = data.deposit.transactions.map(rawTx =>
      getFragmentData(DepositTransactionFieldsFragmentDoc, rawTx),
    );

    // Sort by date ascending for cumulative calculation
    const sortedTransactions = [...transactions].sort((a, b) => {
      const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      return dateA - dateB;
    });

    let cumulativeBalance = 0;
    let localCumulativeBalance = 0;

    return sortedTransactions.map(tx => {
      const amount = Number(tx.amount.raw);
      const localAmount = amount; // TODO: Apply exchange rate conversion

      cumulativeBalance += amount;
      localCumulativeBalance += localAmount;

      return {
        ...tx,
        cumulativeBalance,
        localCumulativeBalance,
        localAmount,
      };
    });
  }, [data?.deposit?.transactions]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  if (fetching) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
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
              No transactions in this deposit.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
