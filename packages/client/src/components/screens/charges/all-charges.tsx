import { useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Loader2, PanelTopClose, PanelTopOpen } from 'lucide-react';
import { useQuery } from 'urql';
import { LoadingOverlay } from '@mantine/core';
import { NewChargesTable } from '@/components/charges/new-charges-table.js';
import { AllChargesDocument, type ChargeFilter } from '../../../gql/graphql.js';
import { useStableValue } from '../../../hooks/use-stable-value.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { ChargesFilters } from '../../charges/charges-filters.js';
import { MergeChargesButton, Tooltip } from '../../common/index.js';
import { PageLayout } from '../../layout/page-layout.js';
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

  const [{ data, fetching }, fetchCharges] = useQuery({
    query: AllChargesDocument,
    variables: {
      filters: filter,
      page: activePage,
      limit: 100,
    },
    pause: true,
  });

  // refetch charges on filter or page change
  useEffect(() => {
    if (filter) {
      fetchCharges({ requestPolicy: 'network-only' });
    }
  }, [filter, activePage, fetchCharges]);

  // urql returns a fresh `data` object on every (re)fetch. Keep a stable,
  // deeply-equal reference for the charge nodes so the table and its rows only
  // re-render when the data actually changed — avoiding the "blink" when a
  // refetch returns identical results.
  const chargeNodes = useStableValue(data?.allCharges?.nodes);

  const resetMergeList = useCallback((): void => {
    setMergeSelectedCharges([]);
  }, []);

  // Only the page count is consumed from the query result here. Depend on it
  // directly (instead of the whole `data`/`fetching`) so the filters bar isn't
  // rebuilt on every background refetch.
  const totalPages = data?.allCharges?.pageInfo.totalPages;

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <ChargesFilters
          filter={filter}
          setFilter={setFilter}
          activePage={activePage}
          setPage={setActivePage}
          totalPages={totalPages}
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
    totalPages,
    filter,
    activePage,
    isAllOpened,
    setFiltersContext,
    setActivePage,
    setFilter,
    setIsAllOpened,
    mergeSelectedCharges,
    resetMergeList,
  ]);

  return (
    <PageLayout title="All Charges" description="Manage charges">
      {fetching && !data ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : chargeNodes ? (
        // Keep the current table mounted while a filter/page change refetches,
        // but overlay a spinner so it's clear the charges are being reloaded
        // (the stale rows stay visible underneath instead of blinking away).
        <div className="relative">
          <LoadingOverlay visible={fetching} overlayBlur={1} />
          <NewChargesTable data={chargeNodes} />
        </div>
      ) : (
        <span>Please apply filters</span>
      )}
    </PageLayout>
  );
};
