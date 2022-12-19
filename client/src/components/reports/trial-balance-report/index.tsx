import { useMemo, useState } from 'react';
import { Table } from '@mantine/core';
import { useQuery } from 'urql';
import {
  BusinessTransactionsFilter,
  TrialBalanceReportDocument,
  TrialBalanceReportQuery,
} from '../../../gql/graphql';
import { formatStringifyAmount } from '../../../helpers';
import { useUrlQuery } from '../../../hooks/use-url-query';
import { AccounterLoader, NavBar } from '../../common';

/* GraphQL */ `
  query TrialBalanceReport($filters: BusinessTransactionsFilter) {
    allSortCodes {
      id
      name
      accounts {
        id
        key
        name
      }
    }
    businessTransactionsSumFromLedgerRecords(filters: $filters) {
      ... on BusinessTransactionsSumFromLedgerRecordsSuccessfulResult {
        businessTransactionsSum {
          businessName
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
  const { get } = useUrlQuery();
  const [
    filter,
    // setFilter
  ] = useState<BusinessTransactionsFilter>(
    get('sortCodesReportFilters')
      ? (JSON.parse(
          decodeURIComponent(get('sortCodesReportFilters') as string),
        ) as BusinessTransactionsFilter)
      : {},
  );
  const [{ data, fetching }] = useQuery({
    query: TrialBalanceReportDocument,
    variables: {
      filters: filter,
    },
  });

  const businessTransactionsSum = useMemo(() => {
    return data?.businessTransactionsSumFromLedgerRecords.__typename === 'CommonError'
      ? []
      : data?.businessTransactionsSumFromLedgerRecords.businessTransactionsSum ?? [];
  }, [data?.businessTransactionsSumFromLedgerRecords]);

  const sortCodes = useMemo(() => {
    return data?.allSortCodes ?? [];
  }, [data?.allSortCodes]);

  function roundNearest100(num: number) {
    return Math.round(num / 100) * 100;
  }

  const extendedSortCodes = useMemo(() => {
    const adjustedSortCodes: Record<
      number,
      {
        sortCodes: Array<
          TrialBalanceReportQuery['allSortCodes'][number] & {
            accounts: Array<
              TrialBalanceReportQuery['allSortCodes'][number]['accounts'][number] & {
                transactionsSum?: Extract<
                  TrialBalanceReportQuery['businessTransactionsSumFromLedgerRecords'],
                  { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
                >['businessTransactionsSum'][number];
                // BusinessTransactionSum;
              }
            >;
            credit: number;
            debit: number;
            sum: number;
          }
        >;
        credit: number;
        debit: number;
        sum: number;
      }
    > = {};

    sortCodes.map(sortCode => {
      const group = roundNearest100(sortCode.id);
      adjustedSortCodes[group] ??= {
        sortCodes: [],
        credit: 0,
        debit: 0,
        sum: 0,
      };

      const accounts = sortCode.accounts.map(account => {
        return {
          ...account,
          transactionsSum: businessTransactionsSum.find(s => s.businessName === account.key),
        };
      });

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
          (total, account) =>
            total + (account.transactionsSum?.total.raw ? account.transactionsSum.total.raw : 0),
          0,
        ),
      };
      adjustedSortCodes[group]['sortCodes'].push(extendedSortCode);
      adjustedSortCodes[group].sum += extendedSortCode.sum;
    });

    return adjustedSortCodes;
  }, [sortCodes, businessTransactionsSum]);

  console.log(extendedSortCodes);

  return (
    <div className="text-gray-600 body-font">
      <div className="container md:px-5 px-2 md:py-12 py-2 mx-auto">
        <NavBar
          header="Business Transactions Summery"
          // filters={<BusinessTransactionsFilters filter={filter} setFilter={setFilter} />}
        />
        {fetching ? (
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
              {Object.entries(extendedSortCodes).map(([group, data]) => {
                return (
                  <>
                    {data.sortCodes.map(sortCode => {
                      return sortCode.accounts.length > 0 ? (
                        <>
                          <tr>
                            <td colSpan={7}>
                              <span className="font-bold">{sortCode.name}</span>
                            </td>
                          </tr>
                          {sortCode.accounts.map(account => {
                            const transactionsSum = businessTransactionsSum.find(
                              s => s.businessName === account.key,
                            );
                            const rowTotal = transactionsSum?.total?.raw ?? 0;
                            return (
                              <tr key={account.id}>
                                <td>{sortCode.id}</td>
                                <td>{account.key}</td>
                                <td>{account.name ?? undefined}</td>
                                <td>
                                  {rowTotal < 0 ? transactionsSum?.debit.formatted : undefined}
                                </td>
                                <td>
                                  {rowTotal > 0 ? transactionsSum?.credit.formatted : undefined}
                                </td>
                                <td>{}</td>
                                {/* <td>More Info</td> */}
                              </tr>
                            );
                          })}
                          <tr className="bg-gray-100">
                            {sortCode.accounts.length > 1 ? (
                              <>
                                <td colSpan={2}>Group total:</td>
                                <td colSpan={1}>{sortCode.id}</td>
                                <td colSpan={1}>
                                  {sortCode.debit === 0
                                    ? undefined
                                    : formatStringifyAmount(sortCode.debit)}
                                </td>
                                <td colSpan={1}>
                                  {sortCode.credit === 0
                                    ? undefined
                                    : formatStringifyAmount(sortCode.credit)}
                                </td>
                                <td colSpan={1}>
                                  {sortCode.sum === 0
                                    ? undefined
                                    : formatStringifyAmount(sortCode.sum)}
                                </td>
                              </>
                            ) : undefined}
                          </tr>
                        </>
                      ) : undefined;
                    })}
                    <tr className="bg-gray-100">
                      <td colSpan={2}>Group total:</td>
                      <td colSpan={1}>{group}</td>
                      <td colSpan={1}>{}</td>
                      <td colSpan={1}>{}</td>
                      <td colSpan={1}>
                        {data.sum === 0 ? undefined : formatStringifyAmount(data.sum)}
                      </td>
                    </tr>
                  </>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
};
