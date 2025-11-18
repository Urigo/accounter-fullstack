import { useContext, useMemo, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { getFragmentData } from '@/gql/fragment-masking.js';
import { UserContext } from '@/providers/user-provider.js';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  Currency,
  DepositTransactionFieldsFragmentDoc,
  SharedDepositTransactionsDocument,
} from '../../gql/graphql.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.jsx';
import { columns, type DepositTransactionRowType } from './columns.jsx';
import { DepositReassignDialog } from './deposit-erassign-dialog.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query SharedDepositTransactions($depositId: String!) {
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

const currencyMap: Partial<
  Record<Currency, 'eur' | 'gbp' | 'cad' | 'jpy' | 'aud' | 'sek' | 'usd'>
> = {
  [Currency.Eur]: 'eur',
  [Currency.Gbp]: 'gbp',
  [Currency.Cad]: 'cad',
  [Currency.Jpy]: 'jpy',
  [Currency.Aud]: 'aud',
  [Currency.Sek]: 'sek',
  [Currency.Usd]: 'usd',
};

type Props = {
  depositId: string;
  enableReassign?: boolean;
  refetch?: () => void;
};

export function DepositsTransactionsTable({
  depositId,
  enableReassign = false,
  refetch,
}: Props): ReactElement {
  const { userContext } = useContext(UserContext);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: false }]);

  const [{ data, fetching }] = useQuery({
    query: SharedDepositTransactionsDocument,
    variables: { depositId },
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
      let rate: number | null = null;
      console.log('currency: ', tx.amount.currency);
      const currencyKey = currencyMap[tx.amount.currency];
      console.log('currencyKey:', currencyKey);
      if (currencyKey) {
        rate = tx.debitExchangeRates?.[currencyKey] ?? tx.eventExchangeRates?.[currencyKey] ?? null;
      }
      console.log('rate:', rate, tx.debitExchangeRates ?? tx.eventExchangeRates);
      const amount = Number(tx.amount.raw);
      const localAmount = amount * (rate ?? 1);
      const localCurrency = (userContext?.context.defaultLocalCurrency as Currency) ?? Currency.Ils;

      cumulativeBalance += amount;
      localCumulativeBalance += localAmount;

      return {
        ...tx,
        cumulativeBalance,
        localCumulativeBalance,
        localAmount,
        localCurrency,
      };
    });
  }, [data?.deposit, userContext]);

  const columnsWithActions: ColumnDef<DepositTransactionRowType>[] = useMemo(() => {
    const actionColumns: ColumnDef<DepositTransactionRowType>[] = enableReassign
      ? [
          {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
              <DepositReassignDialog
                depositId={depositId}
                transactionId={row.original.id}
                refetch={refetch}
              />
            ),
          },
        ]
      : [];

    return [...columns, ...actionColumns];
  }, [enableReassign, depositId, refetch]);

  const table = useReactTable({
    data: tableData,
    columns: columnsWithActions,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  if (fetching) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="size-10 animate-spin" />
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
            <TableCell colSpan={columnsWithActions.length} className="h-24 text-center">
              No transactions in this deposit.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
