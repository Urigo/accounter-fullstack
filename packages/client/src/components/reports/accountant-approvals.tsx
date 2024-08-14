import { ReactElement, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { Progress } from '@mantine/core';
import {
  AccountantApprovalsAllChargesDocument,
  ChargeFilter,
  ChargeSortByField,
} from '../../gql/graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { UserContext } from '../../providers/user-provider.jsx';
import { ChargesFilters } from '../all-charges/charges-filters.js';
import { PageLayout } from '../layout/page-layout.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AccountantApprovalsAllCharges($page: Int, $limit: Int, $filters: ChargeFilter) {
    allCharges(page: $page, limit: $limit, filters: $filters) {
      nodes {
        id
        accountantApproval
      }
    }
  }
`;

export const AccountantApprovals = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const { get } = useUrlQuery();
  const { userContext } = useContext(UserContext);
  const [filter, setFilter] = useState<ChargeFilter>(
    get('chargesFilters')
      ? (JSON.parse(decodeURIComponent(get('chargesFilters') as string)) as ChargeFilter)
      : {
          byOwners: [userContext?.ownerId],
          sortBy: {
            field: ChargeSortByField.Date,
            asc: false,
          },
        },
  );

  const [{ data, fetching }] = useQuery({
    query: AccountantApprovalsAllChargesDocument,
    variables: {
      filters: filter,
      page: 1,
      limit: 999_999,
    },
  });

  const charges = data?.allCharges?.nodes.length ?? 0;
  const approvedCharges =
    data?.allCharges?.nodes.filter(charge => charge.accountantApproval === true).length ?? 0;
  const approvalRate = (100 * approvedCharges) / charges;

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <ChargesFilters
          filter={filter}
          setFilter={setFilter}
          activePage={1}
          setPage={() => {}}
          totalPages={1}
        />
      </div>,
    );
  }, [data, fetching, filter, setFiltersContext, setFilter]);

  return (
    <PageLayout title="Accountant Approvals Status">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <div className="mx-10 mt-5">
          <Progress
            color="green"
            radius="xl"
            size="xl"
            label={`${approvalRate.toFixed(2)}% (${approvedCharges} out of ${charges} total)`}
            value={approvalRate}
          />
        </div>
      )}
    </PageLayout>
  );
};
