import { useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Loader2, PanelTopClose, PanelTopOpen } from 'lucide-react';
import { useQuery } from 'urql';
import { LoadingOverlay } from '@mantine/core';
import type { RowSelectionState } from '@tanstack/react-table';
import { ChargesTable } from '@/components/charges/charges-table.js';
import { MissingInfoChargesDocument, type ChargeFilter } from '../../../gql/graphql.js';
import { useStableValue } from '../../../hooks/use-stable-value.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { ChargesFilters } from '../../charges/charges-filters.js';
import { MergeChargesButton, Tooltip } from '../../common/index.js';
import { PageLayout } from '../../layout/page-layout.js';
import { Button } from '../../ui/button.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query MissingInfoCharges($page: Int, $limit: Int, $filters: ChargeFilter) {
    chargesWithMissingRequiredInfo(page: $page, limit: $limit, filters: $filters) {
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

export const MissingInfoCharges = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [isAllOpened, setIsAllOpened] = useState<boolean>(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
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

  // Unlike All Charges, filters here are optional: the unfiltered list of
  // charges with missing info loads on mount.
  const [{ data, fetching }, fetchCharges] = useQuery({
    query: MissingInfoChargesDocument,
    variables: {
      filters: filter,
      page: activePage,
      limit: 100,
    },
  });

  // urql returns a fresh `data` object on every (re)fetch. Keep a stable,
  // deeply-equal reference for the charge nodes so the table and its rows only
  // re-render when the data actually changed — avoiding the "blink" when a
  // refetch returns identical results.
  const chargeNodes = useStableValue(data?.chargesWithMissingRequiredInfo?.nodes);

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
  const totalPages = data?.chargesWithMissingRequiredInfo?.pageInfo.totalPages;

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <ChargesFilters
          filter={filter}
          setFilter={setFilter}
          activePage={activePage}
          setPage={setActivePage}
          totalPages={totalPages}
          withDefaultDateRange={false}
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
    <PageLayout
      title="Missing Info Charges"
      description="Review charges with missing required details"
    >
      {fetching && !data ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        // Keep the current table mounted while a filter/page change refetches,
        // but overlay a spinner so it's clear the charges are being reloaded
        // (the stale rows stay visible underneath instead of blinking away).
        <div className="relative">
          <LoadingOverlay visible={fetching} overlayBlur={1} />
          <ChargesTable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            data={chargeNodes ?? []}
            isAllOpened={isAllOpened}
          />
        </div>
      )}
    </PageLayout>
  );
};
