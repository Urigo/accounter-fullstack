import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Tooltip } from '@mantine/core';
import { MissingInfoChargesDocument } from '../../../gql/graphql.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { ChargesTable } from '../../charges/charges-table.js';
import {
  EditChargeModal,
  InsertDocumentModal,
  MatchDocumentModal,
  MergeChargesButton,
} from '../../common/index.js';
import { PageLayout } from '../../layout/page-layout.js';
import { Button } from '../../ui/button.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query MissingInfoCharges($page: Int, $limit: Int) {
    chargesWithMissingRequiredInfo(page: $page, limit: $limit) {
      nodes {
        id
        ...ChargesTableFields
      }
      pageInfo {
        totalPages
      }
    }
  }
`;

export const MissingInfoCharges = (): ReactElement => {
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
  const [activePage, setActivePage] = useState(get('page') ? Number(get('page')) : 1);

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
    query: MissingInfoChargesDocument,
    variables: {
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
        <Tooltip label="Expand all accounts">
          <Button
            variant="outline"
            size="icon"
            className="size-7.5"
            onClick={(): void => setIsAllOpened(i => !i)}
          >
            {isAllOpened ? (
              <LayoutNavbarCollapse className="size-5" />
            ) : (
              <LayoutNavbarExpand className="size-5" />
            )}
          </Button>
        </Tooltip>
        <MergeChargesButton selected={mergeSelectedCharges} resetMerge={onResetMerge} />
      </div>,
    );
  }, [
    data,
    fetching,
    activePage,
    isAllOpened,
    setFiltersContext,
    setActivePage,
    setIsAllOpened,
    mergeSelectedCharges,
  ]);

  return (
    <PageLayout
      title="Missing Info Charges"
      description="Review charges with missing required details"
    >
      {!data?.chargesWithMissingRequiredInfo.nodes || fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <ChargesTable
          setEditChargeId={setEditChargeId}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
          toggleMergeCharge={toggleMergeCharge}
          mergeSelectedCharges={new Set(mergeSelectedCharges.map(selected => selected.id))}
          data={data?.chargesWithMissingRequiredInfo?.nodes}
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
