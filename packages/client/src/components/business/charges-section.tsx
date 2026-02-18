import { useCallback, useContext, useMemo, useState } from 'react';
import { useQuery } from 'urql';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { BusinessChargesSectionDocument, ChargeSortByField } from '@/gql/graphql.js';
import { UserContext } from '@/providers/user-provider.js';
import { ChargesTable } from '../charges/charges-table';
import { MergeChargesButton, Pagination } from '../common/index.js';

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
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [mergeSelectedCharges, setMergeSelectedCharges] = useState<Array<string>>([]);

  const toggleMergeCharge = useCallback(
    (chargeId: string) => {
      if (mergeSelectedCharges.includes(chargeId)) {
        setMergeSelectedCharges(mergeSelectedCharges.filter(id => id !== chargeId));
      } else {
        setMergeSelectedCharges([...mergeSelectedCharges, chargeId]);
      }
    },
    [mergeSelectedCharges],
  );

  const mergeSelectedChargesSet = useMemo(
    () => new Set(mergeSelectedCharges),
    [mergeSelectedCharges],
  );

  function onResetMerge(): void {
    setMergeSelectedCharges([]);
  }

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
      page: activePageIndex,
      limit: 10,
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
        <div className="flex items-center gap-2">
          {totalPages > 1 && (
            <Pagination
              className="flex-fit w-fit mx-0"
              currentPageIndex={activePageIndex}
              onChange={setActivePageIndex}
              totalPages={totalPages}
            />
          )}

          <MergeChargesButton
            selected={mergeSelectedCharges.map(id => ({
              id,
              onChange: (): void => {
                return;
              },
            }))}
            resetMerge={onResetMerge}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <ChargesTable
            data={charges}
            isAllOpened={false}
            toggleMergeCharge={toggleMergeCharge}
            mergeSelectedCharges={mergeSelectedChargesSet}
          />
        </div>
      </CardContent>
    </Card>
  );
}
