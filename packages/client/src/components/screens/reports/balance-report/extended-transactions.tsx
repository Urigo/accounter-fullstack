import { useEffect, useMemo, type ReactElement } from 'react';
import { X } from 'lucide-react';
import { useQuery } from 'urql';
import { DownloadCSV } from '@/components/transactions-table/download-csv.js';
import { BalanceReportExtendedTransactionsDocument } from '../../../../gql/graphql.js';
import { AccounterLoader } from '../../../common/index.js';
import { TransactionsTable } from '../../../transactions-table/index.js';
import { Button } from '../../../ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.js';
import type { PeriodInfo } from './index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BalanceReportExtendedTransactions($transactionIDs: [UUID!]!) {
    transactionsByIDs(transactionIDs: $transactionIDs) {
      id
      ...TransactionForTransactionsTableFields
      ...TransactionToDownloadForTransactionsTableFields
    }
  }
`;

type ExtendedTransactionsCardProps = {
  periodInfo?: PeriodInfo;
  onCloseExtendedTransactions: () => void;
};

export const ExtendedTransactionsCard = ({
  periodInfo,
  onCloseExtendedTransactions,
}: ExtendedTransactionsCardProps): ReactElement => {
  const transactionIDs = useMemo(() => {
    return periodInfo?.transactions.map(transaction => transaction.id) || [];
  }, [periodInfo?.transactions]);

  const [{ data, fetching }, refetchTransactions] = useQuery({
    query: BalanceReportExtendedTransactionsDocument,
    variables: {
      transactionIDs,
    },
    pause: transactionIDs.length === 0,
  });

  useEffect(() => {
    if (transactionIDs.length > 0) {
      refetchTransactions();
    }
  }, [transactionIDs, refetchTransactions]);

  const transactions = useMemo(() => {
    if (data?.transactionsByIDs) {
      return transactionIDs
        .map(id => data?.transactionsByIDs.find(transaction => transaction.id === id))
        .filter(Boolean) as NonNullable<(typeof data.transactionsByIDs)[number]>[];
    }
    return [];
  }, [data, transactionIDs]);

  return (
    <Card className="mt-5 w-full">
      {fetching ? (
        <AccounterLoader />
      ) : (
        <>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <span>{periodInfo?.period} Transactions</span>
              <div className="flex flex-row gap-2 items-center">
                <DownloadCSV rawTransactions={transactions} />
                <Button variant="link" onClick={onCloseExtendedTransactions}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionsTable transactionsProps={transactions} />
          </CardContent>
        </>
      )}
    </Card>
  );
};
