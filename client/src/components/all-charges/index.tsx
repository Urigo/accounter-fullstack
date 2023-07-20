import { useCallback, useContext, useEffect, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Tooltip } from '@mantine/core';
import { FiltersContext } from '../../filters-context';
import { FragmentType } from '../../gql';
import {
  AllChargesDocument,
  ChargeFilter,
  ChargeSortByField,
  EditChargeFieldsFragmentDoc,
} from '../../gql/graphql';
import { DEFAULT_FINANCIAL_ENTITY_ID } from '../../helpers';
import { useUrlQuery } from '../../hooks/use-url-query';
import {
  AccounterLoader,
  EditChargeModal,
  InsertDocumentModal,
  MatchDocumentModal,
  UploadDocumentModal,
} from '../common';
import { AllChargesTable } from './all-charges-table';
import { ChargesFilters } from './charges-filters';

/* GraphQL */ `
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
`;

export const AllCharges = () => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [editCharge, setEditCharge] = useState<
    FragmentType<typeof EditChargeFieldsFragmentDoc> | undefined
  >(undefined);
  const [insertDocument, setInsertDocument] = useState<string | undefined>(undefined);
  const [matchDocuments, setMatchDocuments] = useState<{ id: string; ownerId: string } | undefined>(
    undefined,
  );
  const [uploadDocument, setUploadDocument] = useState<string | undefined>(undefined);
  const [isAllOpened, setIsAllOpened] = useState<boolean>(false);
  const [mergeSelectedCharges, setMergeSelectedCharges] = useState<Array<string>>([]);
  const { get } = useUrlQuery();
  const [activePage, setPage] = useState(get('page') ? Number(get('page')) : 1);
  const [filter, setFilter] = useState<ChargeFilter>(
    get('chargesFilters')
      ? (JSON.parse(decodeURIComponent(get('chargesFilters') as string)) as ChargeFilter)
      : {
          byOwners: [DEFAULT_FINANCIAL_ENTITY_ID],
          sortBy: {
            field: ChargeSortByField.Date,
            asc: false,
          },
        },
  );

  const toggleMergeCharge = useCallback(
    (chargeId: string) => {
      if (mergeSelectedCharges.includes(chargeId)) {
        setMergeSelectedCharges(mergeSelectedCharges.filter(id => id !== chargeId));
      } else {
        setMergeSelectedCharges([...mergeSelectedCharges, chargeId]);
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

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <ChargesFilters
          filter={filter}
          setFilter={setFilter}
          activePage={activePage}
          setPage={setPage}
          totalPages={data?.allCharges?.pageInfo.totalPages}
        />
        <Tooltip label="Expand all accounts">
          <ActionIcon variant="default" onClick={() => setIsAllOpened(i => !i)} size={30}>
            {isAllOpened ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
          </ActionIcon>
        </Tooltip>
      </div>,
    );
  }, [
    data,
    fetching,
    filter,
    activePage,
    isAllOpened,
    setFiltersContext,
    setPage,
    setFilter,
    setIsAllOpened,
  ]);

  return (
    <>
      {fetching ? (
        <AccounterLoader />
      ) : (
        <AllChargesTable
          setEditCharge={setEditCharge}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
          setUploadDocument={setUploadDocument}
          toggleMergeCharge={toggleMergeCharge}
          mergeSelectedCharges={mergeSelectedCharges}
          data={data?.allCharges?.nodes}
          isAllOpened={isAllOpened}
        />
      )}
      {editCharge && <EditChargeModal editCharge={editCharge} setEditCharge={setEditCharge} />}
      {insertDocument && (
        <InsertDocumentModal
          insertDocument={insertDocument}
          setInsertDocument={setInsertDocument}
        />
      )}
      {uploadDocument && (
        <UploadDocumentModal
          uploadDocument={uploadDocument}
          setUploadDocument={setUploadDocument}
        />
      )}
      {matchDocuments && (
        <MatchDocumentModal
          chargeId={matchDocuments.id}
          ownerId={matchDocuments.ownerId}
          setMatchDocuments={() => setMatchDocuments(undefined)}
        />
      )}
    </>
  );
};
