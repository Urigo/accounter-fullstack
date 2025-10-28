import { useQuery } from 'urql';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { BusinessLedgerSectionDocument } from '@/gql/graphql.js';
import { LedgerTable } from '../ledger-table';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessLedgerSection($businessId: UUID!) {
    ledgerRecordsByFinancialEntity(financialEntityId: $businessId) {
      id
      ...LedgerRecordsTableFields
    }
  }
`;

interface Props {
  businessId: string;
}

export function LedgerSection({ businessId }: Props) {
  const [{ data, fetching }] = useQuery({
    query: BusinessLedgerSectionDocument,
    variables: {
      businessId,
    },
  });

  if (fetching) {
    return <div>Loading ledger records...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex w-full justify-between items-center">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Ledger Records</CardTitle>
            <CardDescription>Complete ledger history for this business</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <LedgerTable ledgerRecordsData={data?.ledgerRecordsByFinancialEntity ?? []} />
        </div>
      </CardContent>
    </Card>
  );
}
