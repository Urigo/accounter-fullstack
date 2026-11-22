import { useContext, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useQuery } from 'urql';
import { flexRender, useTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { getFragmentData } from '@/gql/fragment-masking.js';
import { useStableValue } from '@/hooks/use-stable-value.js';
import { tableFeaturesConfig, type TableFeaturesConfig } from '@/lib/table-features.js';
import { UserContext } from '@/providers/user-provider.js';
import {
  Currency,
  DepositTransactionFieldsFragmentDoc,
  SharedDepositTransactionsDocument,
} from '../../gql/graphql.js';
import { AccounterBarSpinner } from '../ui/accounter-spinner.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { columns, type DepositRowKind, type DepositTransactionRowType } from './columns.js';
import { DepositReassignDialog } from './deposit-reassign-dialog.js';
import { identifyInterestTransactionIds } from './utils.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query SharedDepositTransactions($depositId: UUID!) {
    deposit(id: $depositId) {
      id
      currency
      metadata {
        id
        transactions {
          id
          ...DepositTransactionFields
        }
      }
      timeline {
        id
        steps {
          id
          chargeId
          date
          revaluation {
            raw
            formatted
            currency
          }
          capitalizedInterest {
            raw
            formatted
            currency
          }
          capitalizedInterestLocal {
            raw
          }
          taxCapitalized {
            raw
            formatted
            currency
          }
          taxPaidOut {
            raw
            formatted
            currency
          }
          source
          warnings
        }
        unmatchedTaxEvents {
          id
          date
          actionTypeDescription
          taxableAmount {
            formatted
          }
        }
        warnings
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
  /**
   * Bumped by the parent whenever any transaction is reassigned. Because the
   * urql client has no cache exchange, mutations don't invalidate queries on
   * their own; each mounted table re-executes its own transactions query when
   * this token changes so both the source and the target deposit refresh.
   */
  reassignToken?: number;
};

export function DepositsTransactionsTable({
  depositId,
  enableReassign = false,
  refetch,
  reassignToken,
}: Props): ReactElement {
  const { userContext } = useContext(UserContext);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: false }]);

  const [{ data, fetching }, reexecuteQuery] = useQuery({
    query: SharedDepositTransactionsDocument,
    variables: { depositId },
  });

  // Re-execute this deposit's transactions query when a reassign happens
  // elsewhere. Skip the initial render — the query already fetches on mount.
  const previousReassignToken = useRef(reassignToken);
  useEffect(() => {
    if (previousReassignToken.current === reassignToken) {
      return;
    }
    previousReassignToken.current = reassignToken;
    reexecuteQuery({ requestPolicy: 'network-only' });
  }, [reassignToken, reexecuteQuery]);

  const computedTableData: DepositTransactionRowType[] = useMemo(() => {
    if (!data?.deposit?.metadata.transactions) {
      return [];
    }

    const transactions = data.deposit.metadata.transactions.map(rawTx => ({
      ...getFragmentData(DepositTransactionFieldsFragmentDoc, rawTx),
      kind: 'transaction' as DepositRowKind,
      source: null as string | null,
      localOverride: null as number | null,
    }));

    // Amounts the bank realized on each deposit event without a transaction of their own:
    // revaluation, interest capitalized into the deposit and tax withheld inside it. Bank-account
    // point of view like the transactions: negative = added to the deposit.
    const localCurrency = (userContext?.context.defaultLocalCurrency as Currency) ?? Currency.Ils;
    const realized: typeof transactions = [];
    for (const step of data.deposit.timeline.steps) {
      const base = {
        chargeId: step.chargeId,
        eventDate: step.date,
        debitExchangeRates: null,
        eventExchangeRates: null,
        source: step.source ?? null,
      };
      if (Math.abs(step.revaluation.raw) >= 0.005) {
        realized.push({
          ...base,
          id: `${step.id}:revaluation`,
          kind: 'revaluation',
          amount: { ...step.revaluation, raw: 0, formatted: '—' },
          localOverride: -step.revaluation.raw,
          source: null,
        });
      }
      if (Math.abs(step.capitalizedInterest.raw) >= 0.005) {
        realized.push({
          ...base,
          id: `${step.id}:interest`,
          kind: 'capitalizedInterest',
          amount: { ...step.capitalizedInterest, raw: -step.capitalizedInterest.raw },
          localOverride: -step.capitalizedInterestLocal.raw,
        });
      }
      const tax = step.taxCapitalized.raw + step.taxPaidOut.raw;
      if (Math.abs(tax) >= 0.005) {
        realized.push({
          ...base,
          id: `${step.id}:tax`,
          kind: 'tax',
          amount: { ...step.taxCapitalized, raw: tax, formatted: tax.toFixed(2) },
          // only the tax withheld inside the deposit reduces it; tax on paid-out interest
          // was taken off the interest line
          localOverride: step.taxCapitalized.raw,
          source: null,
        });
      }
    }

    // Identify interest transactions using shared client helper
    const interestTransactionIds = identifyInterestTransactionIds(transactions, {
      getId: tx => tx.id,
      getChargeId: tx => tx.chargeId,
      getAmount: tx => Number(tx.amount.raw ?? 0),
    });

    // Sort by date ascending for cumulative calculation
    const sortedTransactions = [...realized, ...transactions].sort((a, b) => {
      const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      return dateA - dateB;
    });

    let cumulativeBalance = 0;
    let totalInterest = 0;
    let localCumulativeBalance = 0;

    const rows: DepositTransactionRowType[] = [];

    for (const tx of sortedTransactions) {
      let rate: number | null = null;
      const currencyKey = currencyMap[tx.amount.currency];
      if (currencyKey) {
        rate = tx.debitExchangeRates?.[currencyKey] ?? tx.eventExchangeRates?.[currencyKey] ?? null;
      }
      const amount = Number(tx.amount.raw);
      const localAmount = tx.localOverride ?? amount * (rate ?? 1);
      const isInterest = tx.kind === 'transaction' && interestTransactionIds.has(tx.id);

      if (tx.kind === 'capitalizedInterest') {
        // re-deposited: it is interest and it stays in the deposit
        totalInterest -= amount;
        cumulativeBalance += amount;
        localCumulativeBalance += localAmount;
      } else if (tx.kind === 'revaluation') {
        localCumulativeBalance += localAmount;
      } else if (tx.kind === 'tax') {
        localCumulativeBalance += localAmount;
      } else if (isInterest) {
        // paid out with the event: interest, not principal
        totalInterest += amount;
      } else {
        cumulativeBalance += amount;
        localCumulativeBalance += localAmount;
      }

      const { localOverride: _localOverride, ...row } = tx;
      rows.push({
        ...row,
        cumulativeBalance,
        localCumulativeBalance,
        localAmount,
        localCurrency,
        totalInterest,
        isInterest,
      });
    }

    return rows;
  }, [data, userContext?.context.defaultLocalCurrency]);

  // Keep a stable reference across refetches so the table only re-renders when
  // the transactions actually changed, avoiding a "blink" on background refetch.
  const tableData = useStableValue(computedTableData);

  const columnsWithActions: ColumnDef<TableFeaturesConfig, DepositTransactionRowType>[] =
    useMemo(() => {
      const defaultLocalCurrency =
        (userContext?.context.defaultLocalCurrency as Currency) ?? Currency.Ils;

      const originEqualsLocal =
        !!data?.deposit?.currency && data.deposit.currency === defaultLocalCurrency;

      const baseColumns: ColumnDef<TableFeaturesConfig, DepositTransactionRowType>[] =
        originEqualsLocal
          ? columns.filter(c => c.id !== 'amount' && c.id !== 'cumulativeBalance')
          : columns;

      const actionColumns: ColumnDef<TableFeaturesConfig, DepositTransactionRowType>[] =
        enableReassign
          ? [
              {
                id: 'actions',
                header: 'Actions',
                cell: ({ row }) =>
                  row.original.kind === 'transaction' ? (
                    <DepositReassignDialog
                      depositId={depositId}
                      chargeId={row.original.chargeId}
                      refetch={refetch}
                    />
                  ) : null,
              },
            ]
          : [];

      return [...baseColumns, ...actionColumns];
    }, [enableReassign, depositId, refetch, data, userContext?.context.defaultLocalCurrency]);

  const table = useTable({
    features: tableFeaturesConfig,
    data: tableData,
    columns: columnsWithActions,
    onSortingChange: setSorting,
    state: { sorting },
  });

  if (fetching && !data) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <AccounterBarSpinner />
      </div>
    );
  }

  const timelineWarnings = [
    ...(data?.deposit?.timeline.warnings ?? []),
    ...(data?.deposit?.timeline.steps.flatMap(step => step.warnings) ?? []),
  ];
  const unmatchedTaxEvents = data?.deposit?.timeline.unmatchedTaxEvents ?? [];

  return (
    <>
      {(timelineWarnings.length > 0 || unmatchedTaxEvents.length > 0) && (
        <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
          {timelineWarnings.map(warning => (
            <div key={warning}>{warning}</div>
          ))}
          {unmatchedTaxEvents.length > 0 && (
            <div>
              {unmatchedTaxEvents.length} bank tax event(s) of this account match no deposit event
              (is a deposit charge unassigned?):{' '}
              {unmatchedTaxEvents
                .map(e => `${e.date} ${e.actionTypeDescription} ${e.taxableAmount.formatted}`)
                .join(', ')}
            </div>
          )}
        </div>
      )}
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
    </>
  );
}
