import { useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Loader2, PanelTopClose, PanelTopOpen } from 'lucide-react';
import { useQuery } from 'urql';
import type { RowSelectionState } from '@tanstack/react-table';
import { NewChargesTable } from '@/components/charges/new-charges-table.js';
import { MissingInfoChargesDocument } from '../../../gql/graphql.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { MergeChargesButton, Tooltip } from '../../common/index.js';
import { PageLayout } from '../../layout/page-layout.js';
import { Button } from '../../ui/button.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query MissingInfoCharges($page: Int, $limit: Int) {
    chargesWithMissingRequiredInfo(page: $page, limit: $limit) {
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
  const [activePage, setActivePage] = useState(get('page') ? Number(get('page')) : 1);

  const [{ data, fetching }, refetch] = useQuery({
    query: MissingInfoChargesDocument,
    variables: {
      page: activePage,
      limit: 100,
    },
  });

  // Derive the merge button's input from the row-selection map. Each selected charge gets an
  // `onChange` that refetches the list, so the table refreshes once a merge completes.
  const mergeSelectedCharges = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, isSelected]) => isSelected)
        .map(([id]) => ({
          id,
          onChange: (): void => {
            refetch({ requestPolicy: 'network-only' });
          },
        })),
    [rowSelection, refetch],
  );

  function onResetMerge(): void {
    setRowSelection({});
  }

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
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
        <NewChargesTable
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          data={data?.chargesWithMissingRequiredInfo?.nodes}
          // isAllOpened={isAllOpened}
        />
      )}
    </PageLayout>
  );
};
