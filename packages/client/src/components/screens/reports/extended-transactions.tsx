import { ReactElement } from 'react';
import { X } from 'lucide-react';
import { useQuery } from 'urql';
import { BalanceReportExtendedTransactionsDocument } from '../../../gql/graphql.js';
import { AccounterLoader } from '../../common/index.js';
import { TransactionsTable } from '../../transactions-table/index.js';
import { Button } from '../../ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BalanceReportExtendedTransactions($transactionIDs: [UUID!]!) {
    transactionsByIDs(transactionIDs: $transactionIDs) {
      id
      ...TransactionForTransactionsTableFields
    }
  }
`;

type ExtendedTransactionsCardProps = {
  period: string;
  transactionIDs: string[];
  onCloseExtendedTransactions: () => void;
};

export const ExtendedTransactionsCard = ({
  period,
  transactionIDs,
  onCloseExtendedTransactions,
}: ExtendedTransactionsCardProps): ReactElement => {
  const [{ data, fetching }] = useQuery({
    query: BalanceReportExtendedTransactionsDocument,
    variables: {
      transactionIDs,
    },
  });

  return (
    <Card className="mt-5 w-full">
      {fetching ? (
        <AccounterLoader />
      ) : (
        <>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <span>{period} Transactions</span>
              <Button variant="link" onClick={onCloseExtendedTransactions}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionsTable transactionsProps={data?.transactionsByIDs ?? []} />
          </CardContent>
        </>
      )}
    </Card>
  );
};
