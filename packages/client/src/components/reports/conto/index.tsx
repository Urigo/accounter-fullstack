import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { DndContext, DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
import { ContoReportDocument } from '../../../gql/graphql.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PageLayout } from '../../layout/page-layout.js';
import { TrialBalanceReportFilters } from '../trial-balance-report/trial-balance-report-filters.js';
import { Draggable } from './draggable.js';
import { Droppable } from './droppable.js';
import { SortableTree } from './temp/sortable-tree.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ContoReport($filters: BusinessTransactionsFilter) {
    businessTransactionsSumFromLedgerRecords(filters: $filters) {
      ... on BusinessTransactionsSumFromLedgerRecordsSuccessfulResult {
        businessTransactionsSum {
          business {
            id
            name
            sortCode {
              id
              name
            }
          }
          credit {
            formatted
            raw
          }
          debit {
            formatted
            raw
          }
          total {
            formatted
            raw
          }
        }
      }
      ... on CommonError {
        __typename
      }
    }
  }
`;

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      maxWidth: 600,
      padding: 10,
      margin: '0 auto',
      marginTop: '10%',
    }}
  >
    {children}
  </div>
);

export const ContoReport = (): ReactElement => {
  const { get } = useUrlQuery();
  const [filter, setFilter] = useState<TrialBalanceReportFilters>(
    get('trialBalanceReportFilters')
      ? (JSON.parse(
          decodeURIComponent(get('trialBalanceReportFilters') as string),
        ) as TrialBalanceReportFilters)
      : {},
  );
  const { setFiltersContext } = useContext(FiltersContext);
  const [parent, setParent] = useState<UniqueIdentifier | null>(null);

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: ContoReportDocument,
    variables: {
      filters: {
        fromDate: filter?.fromDate,
        toDate: filter?.toDate,
        ownerIds: filter?.ownerIds,
        businessIDs: filter?.businessIDs,
      },
    },
  });

  const records = useMemo(() => {
    if (
      !data?.businessTransactionsSumFromLedgerRecords ||
      !('businessTransactionsSum' in data.businessTransactionsSumFromLedgerRecords)
    ) {
      return [];
    }
    return data.businessTransactionsSumFromLedgerRecords.businessTransactionsSum;
  }, [data]);

  useEffect(() => {
    setFiltersContext(
      <div className="flex items-center justify-end space-x-2 py-4">
        <TrialBalanceReportFilters filter={filter} setFilter={setFilter} />
      </div>,
    );
  }, [filter, setFilter, setFiltersContext]);

  // function handleDragEnd(event: DragEndEvent) {
  //   const { over } = event;

  //   console.log('over', over.id);

  //   // If the item is dropped over a container, set it as the parent
  //   // otherwise reset the parent to `null`
  //   setParent(over ? over.id : null);
  // }

  // const draggableMarkup = <Draggable id="draggable">Drag Me</Draggable>;

  // const containers = ['A', 'B', 'C'];
  return (
    <PageLayout title="Yearly Ledger Report">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <div className="flex flex-col gap-4 rounded-md border">
          <Wrapper>
            <SortableTree collapsible indicator removable />
          </Wrapper>
          {/* <DndContext onDragEnd={handleDragEnd}>
            {parent === null ? draggableMarkup : null}
            {containers.map(id => (
              // We updated the Droppable component so it would accept an `id`
              // prop and pass it to `useDroppable`
              <Droppable key={id} id={id}>
                {parent === id ? draggableMarkup : 'Drop here'}
              </Droppable>
            ))}
          </DndContext> */}
        </div>
      )}
    </PageLayout>
  );
};
