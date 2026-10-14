import { useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery } from 'urql';
import { TrialBalanceReportDocument } from '../../../gql/graphql.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { Tooltip } from '../../common/index.js';
import { PageLayout } from '../../layout/page-layout.js';
import { AccounterBarSpinner } from '../../ui/accounter-spinner.js';
import { Button } from '../../ui/button.js';
import { TrialBalanceRefreshContext } from './trial-balance-refresh-context.js';
import { TrialBalanceReportFilters } from './trial-balance-report-filters.js';
import { TrialBalanceTable } from './trial-balance-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query TrialBalanceReport($filters: BusinessTransactionsFilter) {
    businessTransactionsSumFromLedgerRecords(filters: $filters) {
      ... on BusinessTransactionsSumFromLedgerRecordsSuccessfulResult {
        __typename
        ...TrialBalanceTableFields
      }
      ... on CommonError {
        __typename
      }
    }
  }
`;

export const TrialBalanceReport = (): ReactElement => {
  const [isAllOpened, setIsAllOpened] = useState(false);
  const { get } = useUrlQuery();
  const { setFiltersContext } = useContext(FiltersContext);
  const [filter, setFilter] = useState<TrialBalanceReportFilters>(
    get('trialBalanceReportFilters')
      ? (JSON.parse(
          decodeURIComponent(get('trialBalanceReportFilters') as string),
        ) as TrialBalanceReportFilters)
      : {},
  );
  const [refreshing, setRefreshing] = useState(false);
  const [{ data, fetching }, reexecuteQuery] = useQuery({
    query: TrialBalanceReportDocument,
    variables: {
      filters: {
        fromDate: filter?.fromDate,
        toDate: filter?.toDate,
        ownerIds: filter?.ownerIds,
        businessIDs: filter?.businessIDs,
      },
    },
  });
  // A refresh after an insert keeps the table mounted, so expanded entities stay open; a filter
  // change still shows the spinner
  const refresh = useCallback(() => {
    setRefreshing(true);
    reexecuteQuery({ requestPolicy: 'network-only' });
  }, [reexecuteQuery]);
  useEffect(() => {
    if (!fetching) {
      setRefreshing(false);
    }
  }, [fetching]);

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-2">
        <Tooltip content="Expand all accounts">
          <Button
            variant="outline"
            size="icon"
            className="size-7.5"
            onClick={(): void => setIsAllOpened(i => !i)}
          >
            {isAllOpened ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
          </Button>
        </Tooltip>
        <TrialBalanceReportFilters filter={filter} setFilter={setFilter} />
      </div>,
    );
  }, [filter, isAllOpened, setFiltersContext]);

  const businessTransactionsData = useMemo(() => {
    return data?.businessTransactionsSumFromLedgerRecords.__typename === 'CommonError'
      ? undefined
      : data?.businessTransactionsSumFromLedgerRecords;
  }, [data?.businessTransactionsSumFromLedgerRecords]);

  return (
    <PageLayout title="Trial Balance Report" description="Trial balance report for all businesses">
      {(fetching && !refreshing) || !businessTransactionsData ? (
        <AccounterBarSpinner className="self-center" />
      ) : (
        <TrialBalanceRefreshContext.Provider value={refresh}>
          <TrialBalanceTable
            data={businessTransactionsData}
            filter={filter}
            isAllOpened={isAllOpened}
          />
        </TrialBalanceRefreshContext.Provider>
      )}
    </PageLayout>
  );
};
