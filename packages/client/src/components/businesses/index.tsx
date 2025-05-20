import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Table, Tooltip } from '@mantine/core';
import { AllBusinessesForScreenDocument, AllBusinessesForScreenQuery } from '../../gql/graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { cn } from '../../lib/utils.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { MergeBusinessesButton } from '../common/index.js';
import { PageLayout } from '../layout/page-layout.js';
import { Button } from '../ui/button.js';
import { AllBusinessesRow } from './all-businesses-row.js';
import { BusinessesFilters } from './businesses-filters.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllBusinessesForScreen($page: Int, $limit: Int, $name: String) {
    allBusinesses(page: $page, limit: $limit, name: $name) {
      nodes {
        __typename
        id
        name
        ... on LtdFinancialEntity {
          ...AllBusinessesRowFields
        }
      }
      pageInfo {
        totalPages
      }
    }
  }
`;

export const Businesses = (): ReactElement => {
  const { get } = useUrlQuery();
  const [isAllOpened, setIsAllOpened] = useState<boolean>(false);
  const [activePage, setActivePage] = useState(get('page') ? Number(get('page')) : 1);
  const [businessName, setBusinessName] = useState(
    get('name') ? (get('page') as string) : undefined,
  );
  const { setFiltersContext } = useContext(FiltersContext);

  const [{ data, fetching }] = useQuery({
    query: AllBusinessesForScreenDocument,
    variables: {
      page: activePage,
      limit: 100,
      name: businessName,
    },
  });

  const [mergeSelectedBusinesses, setMergeSelectedBusinesses] = useState<
    Array<{ id: string; onChange: () => void }>
  >([]);

  const toggleMergeBusiness = useCallback(
    (businessId: string, onChange: () => void) => {
      if (mergeSelectedBusinesses.map(selected => selected.id).includes(businessId)) {
        setMergeSelectedBusinesses(
          mergeSelectedBusinesses.filter(selected => selected.id !== businessId),
        );
      } else {
        setMergeSelectedBusinesses([...mergeSelectedBusinesses, { id: businessId, onChange }]);
      }
    },
    [mergeSelectedBusinesses],
  );

  function onResetMerge(): void {
    setMergeSelectedBusinesses([]);
  }

  // Footer
  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <BusinessesFilters
          activePage={activePage}
          setPage={setActivePage}
          businessName={businessName}
          setBusinessName={setBusinessName}
          totalPages={data?.allBusinesses?.pageInfo.totalPages}
        />
        <Tooltip label="Expand all businesses">
          <Button
            variant="outline"
            size="icon"
            className="size-7.5"
            onClick={(): void => setIsAllOpened(i => !i)}
          >
            {isAllOpened ? (
              <LayoutNavbarCollapse className="size-5" />
            ) : (
              <LayoutNavbarExpand className="size-5" />
            )}
          </Button>
        </Tooltip>
        <MergeBusinessesButton selected={mergeSelectedBusinesses} resetMerge={onResetMerge} />
      </div>,
    );
  }, [
    data,
    activePage,
    businessName,
    isAllOpened,
    setFiltersContext,
    setActivePage,
    setBusinessName,
    setIsAllOpened,
    mergeSelectedBusinesses,
  ]);

  const businesses =
    data?.allBusinesses?.nodes
      .filter(business => business.__typename === 'LtdFinancialEntity')
      .sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1)) ?? [];

  const selectedIds = new Set(mergeSelectedBusinesses.map(selected => selected.id));

  return (
    <PageLayout title={`Businesses (${businesses.length})`} description="All businesses">
      {fetching ? (
        <div className="flex flex-row justify-center">
          <Loader2 className={cn('h-10 w-10 animate-spin mr-2')} />
        </div>
      ) : (
        <Table striped highlightOnHover>
          <thead className="sticky top-0 z-20">
            <tr className="px-10 py-10 title-font tracking-wider font-medium text-gray-900 text-sm bg-gray-100 rounded-tl rounded-bl">
              <th>Name</th>
              <th>Hebrew Name</th>
              <th>More Info</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map(business => (
              <AllBusinessesRow
                key={business.id}
                data={
                  business as Extract<
                    NonNullable<AllBusinessesForScreenQuery['allBusinesses']>['nodes'][number],
                    { __typename: 'LtdFinancialEntity' }
                  >
                }
                isAllOpened={isAllOpened}
                toggleMergeBusiness={
                  toggleMergeBusiness
                    ? (onChange: () => void): void => toggleMergeBusiness(business.id, onChange)
                    : undefined
                }
                isSelectedForMerge={selectedIds.has(business.id) ?? false}
              />
            ))}
          </tbody>
        </Table>
      )}
    </PageLayout>
  );
};
