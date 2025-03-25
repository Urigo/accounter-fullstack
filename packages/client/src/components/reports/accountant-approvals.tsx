import { ReactElement, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { Progress } from '@mantine/core';
import {
  AccountantApprovalsChargesTableDocument,
  ChargeFilter,
  ChargeSortByField,
} from '../../gql/graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { UserContext } from '../../providers/user-provider.jsx';
import { ChargesFilters } from '../charges/charges-filters.js';
import { PageLayout } from '../layout/page-layout.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AccountantApprovalsChargesTable($page: Int, $limit: Int, $filters: ChargeFilter) {
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
          byOwners: userContext?.context.adminBusinessId
            ? [userContext?.context.adminBusinessId]
            : [],
          sortBy: {
            field: ChargeSortByField.Date,
            asc: false,
          },
          toAnyDate: null,
          fromAnyDate: null,
        },
  );

  const [{ data, fetching }] = useQuery({
    query: AccountantApprovalsChargesTableDocument,
    variables: {
      filters: filter,
      page: 1,
      limit: 999_999,
    },
  });

  const charges = data?.allCharges?.nodes.length ?? 0;
  let approved = 0;
  let pending = 0;
  let Unapproved = 0;
  data?.allCharges?.nodes.map(charge => {
    switch (charge.accountantApproval) {
      case 'APPROVED':
        approved += 1;
        break;
      case 'PENDING':
        pending += 1;
        break;
      case 'UNAPPROVED':
        Unapproved += 1;
        break;
    }
  });
  const approvalRate = (100 * approved) / charges;
  const pendingRate = (100 * pending) / charges;
  const UnapprovedRate = (100 * Unapproved) / charges;

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
        <div className="mx-10 mt-5 flex flex-col gap-5">
          {`Total charges: ${charges}`}
          <Progress
            color="green"
            radius="xl"
            size="xl"
            sections={[
              {
                value: approvalRate,
                color: 'green',
                label: `${approvalRate.toFixed(1)}% (${approved})`,
              },
              {
                value: pendingRate,
                color: 'orange',
                label: `${pendingRate.toFixed(1)}% (${pending})`,
              },
              {
                value: UnapprovedRate,
                color: 'red',
                label: `${UnapprovedRate.toFixed(1)}% (${Unapproved})`,
              },
            ]}
          />
        </div>
      )}
    </PageLayout>
  );
};
