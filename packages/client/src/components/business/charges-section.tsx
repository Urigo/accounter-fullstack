import { useContext, useState } from 'react';
import { useQuery } from 'urql';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { BusinessChargesSectionDocument, ChargeSortByField } from '@/gql/graphql.js';
import { UserContext } from '@/providers/user-provider.js';
import { Pagination } from '@mantine/core';
import { ChargesTable } from '../charges/charges-table';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessChargesSection($page: Int, $limit: Int, $filters: ChargeFilter) {
    allCharges(page: $page, limit: $limit, filters: $filters) {
      nodes {
        id
        ...ChargesTableFields
      }
      pageInfo {
        totalPages
      }
    }
  }
`;

interface Props {
  businessId: string;
}

export function ChargesSection({ businessId }: Props) {
  const { userContext } = useContext(UserContext);
  const [activePage, setActivePage] = useState(1);

  const [{ data, fetching }] = useQuery({
    query: BusinessChargesSectionDocument,
    variables: {
      filters: {
        byOwners: userContext?.context.adminBusinessId
          ? [userContext.context.adminBusinessId]
          : undefined,
        sortBy: {
          field: ChargeSortByField.Date,
          asc: false,
        },
        byBusinesses: [businessId],
      },
      page: activePage,
      limit: 100,
    },
  });

  const totalPages = data?.allCharges?.pageInfo.totalPages ?? 1;
  const charges = data?.allCharges?.nodes ?? [];

  if (fetching) {
    return <div>Loading charges...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex w-full justify-between items-center">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Charges</CardTitle>
            <CardDescription>Recurring and one-time charges for this business</CardDescription>
          </div>
        </div>
        {totalPages > 1 && (
          <Pagination
            className="flex-fit"
            value={activePage}
            onChange={setActivePage}
            total={totalPages}
          />
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <ChargesTable data={charges} isAllOpened={false} />
        </div>
      </CardContent>
    </Card>
  );
}
