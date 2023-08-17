import { useContext, useEffect, useMemo, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Tooltip } from '@mantine/core';
import { FiltersContext } from '../../../filters-context';
import { TrialBalanceReportDocument } from '../../../gql/graphql';
import { useUrlQuery } from '../../../hooks/use-url-query';
import { AccounterLoader } from '../../common';
import { TrialBalanceReportFilters } from './trial-balance-report-filters';
import { TrialBalanceTable } from './trial-balance-table';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query TrialBalanceReport($filters: BusinessTransactionsFilter) {
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
          }
          debit {
            formatted
          }
          total {
            formatted
            raw
          }
          eurSum {
            credit {
              formatted
            }
            debit {
              formatted
            }
            total {
              formatted
              raw
            }
          }
          gbpSum {
            credit {
              formatted
            }
            debit {
              formatted
            }
            total {
              formatted
              raw
            }
          }
          usdSum {
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
      }
      ... on CommonError {
        __typename
        message
      }
    }
  }
`;

export const TrialBalanceReport = () => {
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
  const [{ data, fetching }] = useQuery({
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
  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-2">
        <Tooltip label="Expand all accounts">
          <ActionIcon variant="default" onClick={() => setIsAllOpened(i => !i)} size={30}>
            {isAllOpened ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
          </ActionIcon>
        </Tooltip>
        <TrialBalanceReportFilters filter={filter} setFilter={setFilter} />
      </div>,
    );
  }, [filter, isAllOpened, setFiltersContext]);

  const businessTransactionsSum = useMemo(() => {
    return data?.businessTransactionsSumFromLedgerRecords.__typename === 'CommonError'
      ? []
      : data?.businessTransactionsSumFromLedgerRecords.businessTransactionsSum ?? [];
  }, [data?.businessTransactionsSumFromLedgerRecords]);

  return fetching ? (
    <AccounterLoader />
  ) : (
    <TrialBalanceTable
      businessTransactionsSum={businessTransactionsSum}
      filter={filter}
      isAllOpened={isAllOpened}
    />
  );
};
