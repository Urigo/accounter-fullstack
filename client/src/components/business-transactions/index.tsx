import { useState } from 'react';
import { Mark } from '@mantine/core';
import { useQuery } from 'urql';
import { BusinessTransactionsFilter, BusinessTransactionsSummeryDocument } from '../../gql/graphql';
import { useUrlQuery } from '../../hooks/use-url-query';
import { AccounterLoader, AccounterTable, NavBar } from '../common';
import { BusinessExtendedInfo } from './business-extended-info';
import { BusinessTransactionsFilters } from './business-transactions-filters';

/* GraphQL */ `
  query BusinessTransactionsSummery($filters: BusinessTransactionsFilter) {
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
            }
            debit {
              formatted
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

export const BusinessTransactionsSummery = () => {
  const { get } = useUrlQuery();
  const [filter, setFilter] = useState<BusinessTransactionsFilter>(
    get('transactionsFilters')
      ? (JSON.parse(
          decodeURIComponent(get('transactionsFilters') as string),
        ) as BusinessTransactionsFilter)
      : {},
  );
  const [{ data, fetching }] = useQuery({
    query: BusinessTransactionsSummeryDocument,
    variables: {
      filters: filter,
    },
  });

  return (
    <div className="text-gray-600 body-font">
      <div className="container md:px-5 px-2 md:py-12 py-2 mx-auto">
        <NavBar
          header="Business Transactions Summery"
          filters={<BusinessTransactionsFilters filter={filter} setFilter={setFilter} />}
        />
        {fetching ? (
          <AccounterLoader />
        ) : (
          <AccounterTable
            showButton={true}
            moreInfo={item => (
              <BusinessExtendedInfo businessName={item.businessName} filter={filter} />
            )}
            striped
            highlightOnHover
            stickyHeader
            items={
              data?.businessTransactionsSumFromLedgerRecords.__typename === 'CommonError'
                ? []
                : data?.businessTransactionsSumFromLedgerRecords.businessTransactionsSum ?? []
            }
            columns={[
              {
                title: 'Business Name',
                value: data => data.businessName,
              },
              {
                title: 'Debit',
                value: data => data.debit.formatted,
              },
              {
                title: 'Credit',
                value: data => data.credit.formatted,
              },
              {
                title: 'Total',
                value: data =>
                  data.total.raw && (data.total.raw < -0.0001 || data.total.raw > 0.0001) ? (
                    <Mark color={data.total.raw > 0 ? 'green' : 'red'}>{data.total.formatted}</Mark>
                  ) : (
                    data.total.formatted
                  ),
              },
              {
                title: 'EUR Debit',
                value: data => data.eurSum?.debit?.formatted,
              },
              {
                title: 'EUR Credit',
                value: data => data.eurSum?.credit?.formatted,
              },
              {
                title: 'EUR Total',
                value: data =>
                  data.eurSum?.total?.raw &&
                  (data.eurSum.total.raw < -0.0001 || data.eurSum.total.raw > 0.0001) ? (
                    <Mark color={data.eurSum.total.raw > 0 ? 'green' : 'red'}>
                      {data.eurSum.total.formatted}
                    </Mark>
                  ) : (
                    data.eurSum?.total?.formatted
                  ),
              },
              {
                title: 'USD Debit',
                value: data => data.usdSum?.debit?.formatted,
              },
              {
                title: 'USD Credit',
                value: data => data.usdSum?.credit?.formatted,
              },
              {
                title: 'USD Total',
                value: data =>
                  data.usdSum?.total?.raw &&
                  (data.usdSum.total.raw < -0.0001 || data.usdSum.total.raw > 0.0001) ? (
                    <Mark color={data.usdSum.total.raw > 0 ? 'green' : 'red'}>
                      {data.usdSum.total.formatted}
                    </Mark>
                  ) : (
                    data.usdSum?.total?.formatted
                  ),
              },
              {
                title: 'GBP Debit',
                value: data => data.gbpSum?.debit?.formatted,
              },
              {
                title: 'GBP Credit',
                value: data => data.gbpSum?.credit?.formatted,
              },
              {
                title: 'GBP Total',
                value: data =>
                  data.gbpSum?.total?.raw &&
                  (data.gbpSum.total.raw < -0.0001 || data.gbpSum.total.raw > 0.0001) ? (
                    <Mark color={data.gbpSum.total.raw > 0 ? 'green' : 'red'}>
                      {data.gbpSum.total.formatted}
                    </Mark>
                  ) : (
                    data.gbpSum?.total?.formatted
                  ),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
};
