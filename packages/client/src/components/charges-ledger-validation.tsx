import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { format, sub } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Check, LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Loader, Progress, ThemeIcon, Tooltip } from '@mantine/core';
import {
  ChargeFilter,
  ChargesLedgerValidationDocument,
  ChargeSortByField,
} from '../gql/graphql.js';
import { TimelessDateString } from '../helpers/dates.js';
import { useUrlQuery } from '../hooks/use-url-query.js';
import { FiltersContext } from '../providers/filters-context.js';
import { UserContext } from '../providers/user-provider.js';
import { ChargesFilters } from './charges/charges-filters.js';
import { ChargesTable } from './charges/charges-table.js';
import {
  EditChargeModal,
  InsertDocumentModal,
  MatchDocumentModal,
  MergeChargesButton,
} from './common/index.js';
import { PageLayout } from './layout/page-layout.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargesLedgerValidation($limit: Int, $filters: ChargeFilter) {
    chargesWithLedgerChanges(limit: $limit, filters: $filters) @stream {
      progress
      charge {
        id
        ...ChargesTableFields
      }
    }
  }
`;

export const ChargesLedgerValidation = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [editChargeId, setEditChargeId] = useState<
    { id: string; onChange: () => void } | undefined
  >(undefined);
  const [insertDocument, setInsertDocument] = useState<
    { id: string; onChange: () => void } | undefined
  >(undefined);
  const [matchDocuments, setMatchDocuments] = useState<{ id: string; ownerId: string } | undefined>(
    undefined,
  );
  const [isAllOpened, setIsAllOpened] = useState<boolean>(false);
  const [mergeSelectedCharges, setMergeSelectedCharges] = useState<
    Array<{ id: string; onChange: () => void }>
  >([]);
  const { get } = useUrlQuery();
  const { userContext } = useContext(UserContext);
  const [filter, setFilter] = useState<ChargeFilter>(
    get('chargesFilters')
      ? (JSON.parse(decodeURIComponent(get('chargesFilters') as string)) as ChargeFilter)
      : {
          byOwners: userContext?.ownerId ? [userContext.ownerId] : [],
          sortBy: {
            field: ChargeSortByField.Date,
            asc: false,
          },
          toAnyDate: format(new Date(), 'yyyy-MM-dd') as TimelessDateString,
          fromAnyDate: format(sub(new Date(), { years: 1 }), 'yyyy-MM-dd') as TimelessDateString,
        },
  );

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

  const [{ data, fetching }, validateLedger] = useQuery({
    query: ChargesLedgerValidationDocument,
    variables: {
      filters: filter,
      //   limit: 1000,
    },
    pause: true,
  });

  function onResetMerge(): void {
    setMergeSelectedCharges([]);
  }

  const progress = useMemo(
    () =>
      data?.chargesWithLedgerChanges?.length
        ? data.chargesWithLedgerChanges[data.chargesWithLedgerChanges.length - 1].progress
        : 0,
    [data?.chargesWithLedgerChanges],
  );

  const onFilterChange = useCallback(
    (newFilter: ChargeFilter): void => {
      setFilter(newFilter);
      validateLedger();
    },
    [setFilter, validateLedger],
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
          activePage={1}
          setPage={() => {}}
          initiallyOpened
        />
        <Tooltip label="Expand all accounts">
          <ActionIcon variant="default" onClick={(): void => setIsAllOpened(i => !i)} size={30}>
            {isAllOpened ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
          </ActionIcon>
        </Tooltip>
        <MergeChargesButton selected={mergeSelectedCharges} resetMerge={onResetMerge} />
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
      {fetching && <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />}
      {!fetching && (
        <ChargesTable
          setEditChargeId={setEditChargeId}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
          toggleMergeCharge={toggleMergeCharge}
          mergeSelectedCharges={new Set(mergeSelectedCharges.map(selected => selected.id))}
          data={
            data?.chargesWithLedgerChanges.filter(res => !!res.charge).map(res => res.charge!) ?? []
          }
          isAllOpened={isAllOpened}
        />
      )}
      {!fetching && (
        <div className="flex flex-row justify-center my-2">
          {progress < 100 && <Loader />}
          {progress === 100 &&
            !data?.chargesWithLedgerChanges.filter(res => !!res.charge).length && (
              <ThemeIcon radius="xl" size="xl" color="green">
                <Check />
              </ThemeIcon>
            )}
        </div>
      )}
      {editChargeId && (
        <EditChargeModal
          chargeId={editChargeId?.id}
          close={() => setEditChargeId(undefined)}
          onChange={editChargeId.onChange}
        />
      )}
      {insertDocument && (
        <InsertDocumentModal
          chargeId={insertDocument.id}
          onChange={insertDocument.onChange}
          close={(): void => setInsertDocument(undefined)}
        />
      )}
      {matchDocuments && (
        <MatchDocumentModal
          chargeId={matchDocuments.id}
          ownerId={matchDocuments.ownerId}
          setMatchDocuments={(): void => setMatchDocuments(undefined)}
        />
      )}
    </PageLayout>
  );
};
