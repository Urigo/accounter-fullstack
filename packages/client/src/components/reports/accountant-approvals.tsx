import { useContext, useEffect, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import {
  AccountantApprovalsChargesTableDocument,
  ChargeSortByField,
  type ChargeFilter,
} from '../../gql/graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { cn } from '../../lib/utils.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { UserContext } from '../../providers/user-provider.js';
import { ChargesFilters } from '../charges/charges-filters/index.js';
import { PageLayout } from '../layout/page-layout.js';

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
      page: 0,
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
          activePage={0}
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
          <SegmentedProgress
            segments={[
              {
                id: 'approved',
                value: approvalRate,
                className: 'bg-green-500',
                label: `${approvalRate.toFixed(1)}% (${approved})`,
              },
              {
                id: 'pending',
                value: pendingRate,
                className: 'bg-orange-500',
                label: `${pendingRate.toFixed(1)}% (${pending})`,
              },
              {
                id: 'unapproved',
                value: UnapprovedRate,
                className: 'bg-red-500',
                label: `${UnapprovedRate.toFixed(1)}% (${Unapproved})`,
              },
            ]}
          />
        </div>
      )}
    </PageLayout>
  );
};

/**
 * Replaces Mantine's `Progress` in its `sections` form, which `ui/progress` has no equivalent
 * for — it is a single-value bar. Sizes are Mantine's: `size="xl"` is 16px tall and
 * `radius="xl"` is fully rounded, and the colours are its green/orange/red 6-shade.
 */
function SegmentedProgress({
  segments,
}: {
  /** `id` rather than `label` carries the identity: an even split renders the same label
      in every segment (three of three charges is `33.3% (1)` three times over). */
  segments: Array<{ id: string; value: number; className: string; label: string }>;
}): ReactElement {
  return (
    <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-200">
      {segments.map(segment => (
        <div
          key={segment.id}
          style={{ width: `${segment.value}%` }}
          className={cn(
            'flex items-center justify-center overflow-hidden text-[10px] font-bold whitespace-nowrap text-white',
            segment.className,
          )}
        >
          {segment.label}
        </div>
      ))}
    </div>
  );
}
