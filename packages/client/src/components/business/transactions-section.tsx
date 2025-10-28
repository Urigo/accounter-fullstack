import { useQuery } from 'urql';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { BusinessTransactionsSectionDocument } from '@/gql/graphql.js';
import { TransactionsTable } from '../transactions-table';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessTransactionsSection($businessId: UUID!) {
    transactionsByFinancialEntity(financialEntityID: $businessId) {
      id
      ...TransactionForTransactionsTableFields
    }
  }
`;
interface Props {
  businessId: string;
}

export function TransactionsSection({ businessId }: Props) {
  const [{ data, fetching }] = useQuery({
    query: BusinessTransactionsSectionDocument,
    variables: {
      businessId,
    },
  });

  if (fetching) {
    return <div>Loading transactions...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex w-full justify-between items-center">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>Complete transaction history for this business</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <TransactionsTable transactionsProps={data?.transactionsByFinancialEntity ?? []} />
        </div>
      </CardContent>
    </Card>
  );
}
