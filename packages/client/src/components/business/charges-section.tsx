import { useCallback, useContext, useMemo, useState } from 'react';
import { useQuery } from 'urql';
import type { RowSelectionState } from '@tanstack/react-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { BusinessChargesSectionDocument, ChargeSortByField } from '@/gql/graphql.js';
import { UserContext } from '@/providers/user-provider.js';
import { NewChargesTable } from '../charges/new-charges-table.js';
import { MergeChargesButton, Pagination } from '../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessChargesSection($page: Int, $limit: Int, $filters: ChargeFilter) {
    allCharges(page: $page, limit: $limit, filters: $filters) {
      nodes {
        id
        ...ChargeForChargesTableFields
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
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const onResetMerge = useCallback((): void => {
    setRowSelection({});
  }, []);

  const [{ data, fetching }, refetchCharges] = useQuery({
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

  // Derive the merge button's input from the row-selection map. Each selected charge gets an
  // `onChange` that refetches the list, so the table refreshes once a merge completes.
  const mergeSelectedCharges = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, isSelected]) => isSelected)
        .map(([id]) => ({
          id,
          onChange: (): void => {
            refetchCharges({ requestPolicy: 'network-only' });
          },
        })),
    [rowSelection, refetchCharges],
  );

  const totalPages = data?.allCharges?.pageInfo.totalPages ?? 1;
  const charges = useMemo(() => data?.allCharges?.nodes ?? [], [data]);

  if (fetching && !charges.length) {
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

          <MergeChargesButton selected={mergeSelectedCharges} resetMergeList={onResetMerge} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <NewChargesTable
            data={charges}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
          />
        </div>
      </CardContent>
    </Card>
  );
}
