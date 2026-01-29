import { useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Loader2, PanelTopClose, PanelTopOpen } from 'lucide-react';
import { useQuery } from 'urql';
import { NewChargesTable } from '@/components/charges/new-charges-table.js';
import { AllChargesDocument, type ChargeFilter } from '../../../gql/graphql.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { ChargesFilters } from '../../charges/charges-filters.js';
import { MergeChargesButton, Tooltip } from '../../common/index.js';
import { PageLayout } from '../../layout/page-layout.jsx';
import { Button } from '../../ui/button.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllCharges($page: Int, $limit: Int, $filters: ChargeFilter) {
    allCharges(page: $page, limit: $limit, filters: $filters) {
      nodes {
        id
        ...ChargesTableFields
        ...ChargeForChargesTableFields
      }
      pageInfo {
        totalPages
      }
    }
  }
`;

export const AllCharges = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [isAllOpened, setIsAllOpened] = useState<boolean>(false);
  const [mergeSelectedCharges, setMergeSelectedCharges] = useState<
    Array<{ id: string; onChange: () => void }>
  >([]);
  const { get } = useUrlQuery();
  const [activePage, setActivePage] = useState(get('page') ? Number(get('page')) : 0);
  const uriFilters = get('chargesFilters');
  const initialFilters = useMemo(() => {
    if (uriFilters) {
      try {
        return JSON.parse(decodeURIComponent(uriFilters)) as ChargeFilter;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        return undefined;
      }
    }
    return undefined;
  }, [uriFilters]);
  const [filter, setFilter] = useState<ChargeFilter | undefined>(initialFilters);

  const toggleMergeCharge = useCallback(
    (chargeId: string, onChange: () => void) => {
      if (mergeSelectedCharges.map(selected => selected.id).includes(chargeId)) {
        setMergeSelectedCharges(mergeSelectedCharges.filter(selected => selected.id !== chargeId));
      } else {
        setMergeSelectedCharges([...mergeSelectedCharges, { id: chargeId, onChange }]);
      }
    },
    [mergeSelectedCharges],
  );

  const [{ data, fetching }, fetchCharges] = useQuery({
    query: AllChargesDocument,
    variables: {
      filters: filter,
      page: activePage,
      limit: 100,
    },
    pause: true,
  });

  // refetch charges on filter change
  useEffect(() => {
    if (filter) {
      fetchCharges();
    }
  }, [filter, fetchCharges]);

  const resetMergeList = useCallback((): void => {
    setMergeSelectedCharges([]);
  }, []);

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <ChargesFilters
          filter={filter}
          setFilter={setFilter}
          activePage={activePage}
          setPage={setActivePage}
          totalPages={data?.allCharges?.pageInfo.totalPages}
          initiallyOpened={!filter}
        />
        <Tooltip content="Expand all accounts">
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
        <MergeChargesButton selected={mergeSelectedCharges} resetMergeList={resetMergeList} />
      </div>,
    );
  }, [
    data,
    fetching,
    filter,
    activePage,
    isAllOpened,
    setFiltersContext,
    setActivePage,
    setFilter,
    setIsAllOpened,
    mergeSelectedCharges,
    initialFilters,
    resetMergeList,
  ]);

  return (
    <PageLayout title="All Charges" description="Manage charges">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : data?.allCharges.nodes ? (
        <NewChargesTable data={data?.allCharges.nodes} />
      ) : (
        <span>Please apply filters</span>
      )}
    </PageLayout>
  );
};
