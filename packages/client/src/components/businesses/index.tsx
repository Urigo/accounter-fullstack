import { useCallback, useContext, useEffect, useState, type ReactElement } from 'react';
import { Loader2, PanelTopClose, PanelTopOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'urql';
import { Tooltip } from '@mantine/core';
import { AllBusinessesForScreenDocument } from '../../gql/graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { cn } from '../../lib/utils.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { ROUTES } from '../../router/routes.js';
import { BusinessHeader } from '../business/business-header.js';
import { InsertBusiness, MergeBusinessesButton } from '../common/index.js';
import { PageLayout } from '../layout/page-layout.js';
import { Button } from '../ui/button.js';
import { Checkbox } from '../ui/checkbox.js';
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
          ...BusinessHeader
        }
      }
      pageInfo {
        totalPages
        totalRecords
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

  const [{ data, fetching }, refetch] = useQuery({
    query: AllBusinessesForScreenDocument,
    variables: {
      page: activePage,
      limit: 100,
      name: businessName,
    },
  });

  const navigate = useNavigate();
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
              <PanelTopClose className="size-5" />
            ) : (
              <PanelTopOpen className="size-5" />
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
    <PageLayout
      title={`Businesses (${data?.allBusinesses?.pageInfo.totalRecords ?? ''})`}
      description="All businesses"
      headerActions={
        <div className="flex items-center py-4 gap-4">
          <InsertBusiness description="" onAdd={() => refetch()} />
        </div>
      }
    >
      {fetching ? (
        <div className="flex flex-row justify-center">
          <Loader2 className={cn('h-10 w-10 animate-spin mr-2')} />
        </div>
      ) : (
        <div className="space-y-2">
          {businesses.map(business => (
            <div
              key={business.id}
              className="group relative border rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="pl-4 flex items-center">
                  <Checkbox
                    checked={selectedIds.has(business.id)}
                    onCheckedChange={() => {
                      toggleMergeBusiness(business.id, () => {});
                    }}
                    className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                    onClick={(e): void => e.stopPropagation()}
                  />
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  className="flex-1 cursor-pointer"
                  onClick={(): void => {
                    navigate(ROUTES.BUSINESSES.DETAIL(business.id));
                  }}
                  onKeyDown={(e): void => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(ROUTES.BUSINESSES.DETAIL(business.id));
                    }
                  }}
                >
                  <BusinessHeader data={business} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
};
