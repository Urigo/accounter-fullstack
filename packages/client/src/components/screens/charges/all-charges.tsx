import { useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { PanelTopClose, PanelTopOpen } from 'lucide-react';
import { useQuery } from 'urql';
import type { RowSelectionState } from '@tanstack/react-table';
import { ChargesTable } from '@/components/charges/charges-table.js';
import { AllChargesDocument, type AllChargesQuery } from '../../../gql/graphql.js';
import { isObjectEmpty } from '../../../helpers/form.js';
import { useStableValue } from '../../../hooks/use-stable-value.js';
import { useUrlPage } from '../../../hooks/use-url-page.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import {
  ALL_CHARGES_PAGE_SIZE,
  subscribeAllChargesPrefetch,
  type AllChargesVariables,
} from '../../../router/loaders/all-charges-loader.js';
import { ChargesFilters, useChargesFilter } from '../../charges/charges-filters/index.js';
import { MergeChargesButton, Tooltip } from '../../common/index.js';
import { PageLayout } from '../../layout/page-layout.js';
import { AccounterBarSpinner } from '../../ui/accounter-spinner.js';
import { Button } from '../../ui/button.js';
import { LoadingOverlay } from '../../ui/overlay.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllCharges($page: Int, $limit: Int, $filters: ChargeFilter) {
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

export const AllCharges = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [isAllOpened, setIsAllOpened] = useState<boolean>(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [activePage, setActivePage] = useUrlPage();
  const [filter, setFilter] = useChargesFilter();
  // Nothing is fetched until a filter is applied — the list is too large to load unfiltered.
  const isFilterApplied = !isObjectEmpty(filter);

  const variables = useMemo<AllChargesVariables>(
    () => ({ filters: filter, page: activePage, limit: ALL_CHARGES_PAGE_SIZE }),
    [filter, activePage],
  );

  const [{ data: fetchedData, fetching }, fetchCharges] = useQuery({
    query: AllChargesDocument,
    variables,
    pause: true,
  });

  // The route loader usually started this screen's first request before the screen mounted
  // (see `allChargesLoader`). Its result is kept here, with the variables it was for.
  const [prefetched, setPrefetched] = useState<{
    variables: AllChargesVariables;
    data: AllChargesQuery;
  }>();
  const [awaitingPrefetch, setAwaitingPrefetch] = useState(false);

  // fetch charges on filter or page change, taking over the loader's request when it matches
  useEffect(() => {
    if (!isFilterApplied) {
      return;
    }
    const unsubscribe = subscribeAllChargesPrefetch(variables, outcome => {
      setAwaitingPrefetch(false);
      if (outcome.kind === 'data') {
        // Arrives again as each deferred part of the response lands.
        setPrefetched({ variables, data: outcome.data });
      } else if (outcome.kind === 'skipped') {
        fetchCharges({ requestPolicy: 'network-only' });
      }
    });
    if (!unsubscribe) {
      fetchCharges({ requestPolicy: 'network-only' });
      return;
    }
    setAwaitingPrefetch(true);
    return () => {
      unsubscribe();
      setAwaitingPrefetch(false);
    };
  }, [isFilterApplied, variables, fetchCharges]);

  // urql's result wins once the screen has fetched anything itself. Until then the prefetched
  // result shows, and it keeps showing (as stale rows under the overlay) while the first
  // refetch for other variables is in flight, as urql's own results do.
  const data =
    fetchedData ??
    (prefetched && (fetching || prefetched.variables === variables) ? prefetched.data : undefined);
  const loading = fetching || awaitingPrefetch;

  // urql returns a fresh `data` object on every (re)fetch. Keep a stable,
  // deeply-equal reference for the charge nodes so the table and its rows only
  // re-render when the data actually changed — avoiding the "blink" when a
  // refetch returns identical results.
  // Back to an entry with no filter: don't keep showing the last filter's results.
  const chargeNodes = useStableValue(isFilterApplied ? data?.allCharges?.nodes : undefined);

  const resetMergeList = useCallback((): void => {
    setRowSelection({});
  }, []);

  // Derive the merge button's input from the row-selection map. Each selected charge gets an
  // `onChange` that refetches the list, so the table refreshes once a merge completes.
  const mergeSelectedCharges = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, isSelected]) => isSelected)
        .map(([id]) => ({
          id,
          onChange: (): void => {
            fetchCharges({ requestPolicy: 'network-only' });
          },
        })),
    [rowSelection, fetchCharges],
  );

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
          initiallyOpened={!isFilterApplied}
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
    isFilterApplied,
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
      {loading && !data ? (
        <AccounterBarSpinner className="self-center" />
      ) : chargeNodes ? (
        // Keep the current table mounted while a filter/page change refetches,
        // but overlay a spinner so it's clear the charges are being reloaded
        // (the stale rows stay visible underneath instead of blinking away).
        <div className="relative">
          <LoadingOverlay visible={loading} blur={1} />
          <ChargesTable
            data={chargeNodes}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            isAllOpened={isAllOpened}
            showExport
          />
        </div>
      ) : (
        <span>Please apply filters</span>
      )}
    </PageLayout>
  );
};
