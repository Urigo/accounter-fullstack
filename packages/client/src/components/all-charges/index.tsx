import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Tooltip } from '@mantine/core';
import { graphql, VariablesOf } from '../../graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query';
import { FiltersContext } from '../../providers/filters-context';
import { UserContext } from '../../providers/user-provider.js';
import {
  AccounterLoader,
  EditChargeModal,
  InsertDocumentModal,
  MatchDocumentModal,
  MergeChargesButton,
  UploadDocumentModal,
} from '../common';
import { AllChargesTable } from './all-charges-table';
import { ChargesFilters } from './charges-filters';

export const AllChargesDocument = graphql(`
  query AllCharges($page: Int, $limit: Int, $filters: ChargeFilter) {
    allCharges(page: $page, limit: $limit, filters: $filters) {
      nodes {
        id
        ...AllChargesTableFields
      }
      pageInfo {
        totalPages
      }
    }
  }
`);

export type ChargeFilter = NonNullable<
  NonNullable<VariablesOf<typeof AllChargesDocument>['filters']>
>;

export const AllCharges = (): ReactElement => {
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
  const [activePage, setActivePage] = useState(get('page') ? Number(get('page')) : 1);
  const [filter, setFilter] = useState<ChargeFilter>(
    get('chargesFilters')
      ? (JSON.parse(decodeURIComponent(get('chargesFilters') as string)) as ChargeFilter)
      : {
          byOwners: userContext ? [userContext?.ownerId] : [],
          sortBy: {
            field: 'DATE',
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
    query: AllChargesDocument,
    variables: {
      filters: filter,
      page: activePage,
      limit: 100,
    },
  });

  function onResetMerge(): void {
    setMergeSelectedCharges([]);
  }

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <ChargesFilters
          filter={filter}
          setFilter={setFilter}
          activePage={activePage}
          setPage={setActivePage}
          totalPages={data?.allCharges?.pageInfo.totalPages}
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
    activePage,
    isAllOpened,
    setFiltersContext,
    setActivePage,
    setFilter,
    setIsAllOpened,
    mergeSelectedCharges,
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
          data={data?.allCharges?.nodes}
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
