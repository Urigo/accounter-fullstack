import { useContext, useEffect, useMemo, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Table, Tooltip } from '@mantine/core';
import { FiltersContext } from '../../../filters-context';
import { TrialBalanceReportDocument } from '../../../gql/graphql';
import { formatStringifyAmount } from '../../../helpers';
import { useUrlQuery } from '../../../hooks/use-url-query';
import { AccounterLoader } from '../../common';
import { TrialBalanceReportFilters } from './trial-balance-report-filters';
import { TrialBalanceReportGroup } from './trial-balance-report-group';
import { ExtendedSortCode } from './trial-balance-report-sort-code';

/* GraphQL */ `
  query TrialBalanceReport($filters: BusinessTransactionsFilter) {
    allSortCodes {
      id
      name
      accounts {
        id
        business {
          id
          name
        }
        name
      }
    }
    businessTransactionsSumFromLedgerRecords(filters: $filters) {
      ... on BusinessTransactionsSumFromLedgerRecordsSuccessfulResult {
        businessTransactionsSum {
          business {
            id
            name
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
  const [{ isShowZeroedAccounts, ...filter }, setFilter] = useState<TrialBalanceReportFilters>(
    get('trialBalanceReportFilters')
      ? (JSON.parse(
          decodeURIComponent(get('trialBalanceReportFilters') as string),
        ) as TrialBalanceReportFilters)
      : {},
  );
  const [{ data, fetching }] = useQuery({
    query: TrialBalanceReportDocument,
    variables: {
      filters: filter,
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
        <TrialBalanceReportFilters
          filter={{ ...filter, isShowZeroedAccounts }}
          setFilter={setFilter}
        />
      </div>,
    );
  }, [data, filter, isAllOpened]);

  const businessTransactionsSum = useMemo(() => {
    return data?.businessTransactionsSumFromLedgerRecords.__typename === 'CommonError'
      ? []
      : data?.businessTransactionsSumFromLedgerRecords.businessTransactionsSum ?? [];
  }, [data?.businessTransactionsSumFromLedgerRecords]);

  const sortCodes = useMemo(() => {
    return data?.allSortCodes ?? [];
  }, [data?.allSortCodes]);

  function roundNearest100(num: number) {
    return Math.floor(num / 100) * 100;
  }

  const extendedSortCodes = useMemo(() => {
    const adjustedSortCodes: Record<
      number,
      {
        sortCodes: Array<ExtendedSortCode>;
        credit: number;
        debit: number;
        sum: number;
      }
    > = {};

    sortCodes.map(sortCode => {
      if (!sortCode.accounts.length) return;

      const group = roundNearest100(sortCode.id);
      adjustedSortCodes[group] ??= {
        sortCodes: [],
        credit: 0,
        debit: 0,
        sum: 0,
      };

      const accounts = sortCode.accounts
        .map(account => {
          return {
            ...account,
            transactionsSum: businessTransactionsSum.find(
              s => s.business.id === account.business?.id,
            ),
          };
        })
        .filter(
          account =>
            isShowZeroedAccounts ||
            (account.transactionsSum?.total.raw &&
              (account.transactionsSum.total.raw > 0.001 ||
                account.transactionsSum.total.raw < -0.001)),
        );

      const extendedSortCode = {
        ...sortCode,
        accounts,
        credit: accounts.reduce(
          (credit, account) =>
            credit +
            (account.transactionsSum?.total.raw && account.transactionsSum.total.raw > 0
              ? account.transactionsSum.total.raw
              : 0),
          0,
        ),
        debit:
          accounts.reduce(
            (debit, account) =>
              debit +
              (account.transactionsSum?.total.raw && account.transactionsSum.total.raw < 0
                ? account.transactionsSum.total.raw
                : 0),
            0,
          ) * -1,
        sum: accounts.reduce(
          (total, account) => total + (account.transactionsSum?.total.raw || 0),
          0,
        ),
      };
      adjustedSortCodes[group]['sortCodes'].push(extendedSortCode);
      adjustedSortCodes[group].sum += extendedSortCode.sum;
    });

    return adjustedSortCodes;
  }, [sortCodes, businessTransactionsSum, isShowZeroedAccounts]);

  return fetching ? (
    <AccounterLoader />
  ) : (
    <Table highlightOnHover>
      <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
        <tr className="bg-gray-300">
          <th>Sort Code</th>
          <th>Account</th>
          <th>Account Name</th>
          <th>Debit</th>
          <th>Credit</th>
          <th>Total</th>
          {/* <th>More Info</th> */}
        </tr>
      </thead>
      <tbody>
        {Object.entries(extendedSortCodes).map(([group, data]) => (
          <TrialBalanceReportGroup
            key={group}
            data={data}
            group={group}
            filter={filter}
            isAllOpened={isAllOpened}
          />
        ))}
        <tr className="bg-gray-100">
          <td colSpan={2}>Report total:</td>
          <td colSpan={3}>{}</td>
          <td colSpan={1}>
            {formatStringifyAmount(
              Object.values(extendedSortCodes).reduce((total, row) => total + row.sum, 0),
            )}
          </td>
        </tr>
      </tbody>
    </Table>
  );
};
