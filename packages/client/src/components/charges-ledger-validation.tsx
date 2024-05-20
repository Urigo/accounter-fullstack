import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Progress, Tooltip } from '@mantine/core';
import {
  ChargeFilter,
  ChargesLedgerValidationDocument,
  ChargeSortByField,
} from '../gql/graphql.js';
import { useUrlQuery } from '../hooks/use-url-query';
import { FiltersContext } from '../providers/filters-context';
import { UserContext } from '../providers/user-provider.js';
import { AllChargesTable } from './all-charges/all-charges-table';
import { ChargesFilters } from './all-charges/charges-filters';
import {
  AccounterLoader,
  EditChargeModal,
  InsertDocumentModal,
  MatchDocumentModal,
  MergeChargesButton,
  UploadDocumentModal,
} from './common';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargesLedgerValidation($limit: Int, $filters: ChargeFilter) {
    chargesWithLedgerChanges(limit: $limit, filters: $filters) @stream {
        progress
        charge {
            id
            ...AllChargesTableFields
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
  const [uploadDocument, setUploadDocument] = useState<
    { id: string; onChange: () => void } | undefined
  >(undefined);
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
          byOwners: [userContext?.ownerId],
          sortBy: {
            field: ChargeSortByField.Date,
            asc: false,
          },
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

  const [{ data, fetching }] = useQuery({
    query: ChargesLedgerValidationDocument,
    variables: {
      filters: filter,
      //   limit: 1000,
    },
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
        <ChargesFilters filter={filter} setFilter={setFilter} activePage={1} setPage={() => {}} />
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
    setFilter,
    setIsAllOpened,
    mergeSelectedCharges,
    progress,
  ]);

  return (
    <>
      {fetching ? (
        <AccounterLoader />
      ) : (
        <AllChargesTable
          setEditChargeId={setEditChargeId}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
          setUploadDocument={setUploadDocument}
          toggleMergeCharge={toggleMergeCharge}
          mergeSelectedCharges={new Set(mergeSelectedCharges.map(selected => selected.id))}
          data={
            data?.chargesWithLedgerChanges.filter(res => !!res.charge).map(res => res.charge!) ?? []
          }
          isAllOpened={isAllOpened}
        />
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
      {uploadDocument && (
        <UploadDocumentModal
          chargeId={uploadDocument.id}
          close={() => setUploadDocument(undefined)}
          onChange={uploadDocument.onChange}
        />
      )}
      {matchDocuments && (
        <MatchDocumentModal
          chargeId={matchDocuments.id}
          ownerId={matchDocuments.ownerId}
          setMatchDocuments={(): void => setMatchDocuments(undefined)}
        />
      )}
    </>
  );
};
