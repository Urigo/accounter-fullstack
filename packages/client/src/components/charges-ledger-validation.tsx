import { useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Check, Loader2, PanelTopClose, PanelTopOpen } from 'lucide-react';
import { useQuery } from 'urql';
import { Loader, Progress, ThemeIcon } from '@mantine/core';
import type { RowSelectionState } from '@tanstack/react-table';
import { encodeFilters, ROUTES } from '@/router/routes.js';
import { ChargesLedgerValidationDocument, type ChargeFilter } from '../gql/graphql.js';
import { useUrlQuery } from '../hooks/use-url-query.js';
import { FiltersContext } from '../providers/filters-context.js';
import { ChargesFilters } from './charges/charges-filters.js';
import { NewChargesTable } from './charges/new-charges-table.js';
import { MergeChargesButton, Tooltip } from './common/index.js';
import { PageLayout } from './layout/page-layout.js';
import { Button } from './ui/button.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargesLedgerValidation($limit: Int, $filters: ChargeFilter) {
    chargesWithLedgerChanges(limit: $limit, filters: $filters) @stream {
      progress
      charge {
        id
        ...ChargeForChargesTableFields
      }
    }
  }
`;

export function getLedgerValidationHref(filter?: ChargeFilter | null, page?: number): string {
  const params = new URLSearchParams();
  if (page) {
    params.append('page', String(page));
  }

  const chargesFilters = encodeFilters(filter);
  if (chargesFilters) {
    // Add it as a single encoded parameter
    params.append('chargesFilters', chargesFilters);
  }

  const queryParams = params.size > 0 ? `?${params}` : '';
  return `${ROUTES.CHARGES.LEDGER_VALIDATION}${queryParams}`;
}

export const ChargesLedgerValidation = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [isAllOpened, setIsAllOpened] = useState<boolean>(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const { get } = useUrlQuery();
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

  const [{ data, fetching }, validateLedger] = useQuery({
    query: ChargesLedgerValidationDocument,
    variables: {
      filters: filter,
      //   limit: 1000,
    },
    pause: true,
  });

  function onResetMerge(): void {
    setRowSelection({});
  }

  const progress = data?.chargesWithLedgerChanges?.length
    ? data.chargesWithLedgerChanges[data.chargesWithLedgerChanges.length - 1].progress
    : 0;

  const onFilterChange = useCallback(
    (newFilter: ChargeFilter): void => {
      setFilter(newFilter);
    },
    [setFilter],
  );

  useEffect(() => {
    if (filter) {
      validateLedger();
    }
  }, [filter, validateLedger]);

  // Derive the merge button's input from the row-selection map. Each selected charge gets an
  // `onChange` that refetches the list, so the table refreshes once a merge completes.
  const mergeSelectedCharges = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, isSelected]) => isSelected)
        .map(([id]) => ({
          id,
          onChange: (): void => {
            validateLedger({ requestPolicy: 'network-only' });
          },
        })),
    [rowSelection, validateLedger],
  );

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5 items-center">
        <Progress
          value={progress}
          label={`${progress?.toFixed(2)}%`}
          size="xl"
          animate={progress < 100}
          className="min-w-52"
        />
        <ChargesFilters
          filter={filter}
          setFilter={onFilterChange}
          activePage={0}
          setPage={() => {}}
          initiallyOpened
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
        <MergeChargesButton selected={mergeSelectedCharges} resetMergeList={onResetMerge} />
      </div>,
    );
  }, [
    data,
    fetching,
    filter,
    isAllOpened,
    setFiltersContext,
    setIsAllOpened,
    mergeSelectedCharges,
    progress,
    onFilterChange,
  ]);

  return (
    <PageLayout title="Charges Ledger Validation" description="Manage charges">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <>
          <NewChargesTable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            data={
              data?.chargesWithLedgerChanges.filter(res => !!res.charge).map(res => res.charge!) ??
              []
            }
            // isAllOpened={isAllOpened}
          />
          <div className="flex flex-row justify-center my-2">
            {progress > 0 && progress < 100 && <Loader />}
            {progress === 100 &&
              !data?.chargesWithLedgerChanges.filter(res => !!res.charge).length && (
                <ThemeIcon radius="xl" size="xl" color="green">
                  <Check />
                </ThemeIcon>
              )}
          </div>
        </>
      )}
    </PageLayout>
  );
};
