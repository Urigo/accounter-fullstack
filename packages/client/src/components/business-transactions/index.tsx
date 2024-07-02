import { ReactElement, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Mark, Table, Text, Tooltip } from '@mantine/core';
import {
  BusinessTransactionsFilter,
  BusinessTransactionsSummeryDocument,
} from '../../gql/graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query';
import { FiltersContext } from '../../providers/filters-context';
import { AccounterTableRow } from '../common';
import { PageLayout } from '../layout/page-layout.js';
import { BusinessExtendedInfo } from './business-extended-info';
import { BusinessTransactionsFilters } from './business-transactions-filters';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessTransactionsSummery($filters: BusinessTransactionsFilter) {
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

export const BusinessTransactionsSummery = (): ReactElement => {
  const { get } = useUrlQuery();
  const { setFiltersContext } = useContext(FiltersContext);
  const [isAllOpened, setIsAllOpened] = useState<boolean>(false);
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

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <BusinessTransactionsFilters filter={filter} setFilter={setFilter} />
        <Tooltip label="Expand all accounts">
          <ActionIcon variant="default" onClick={(): void => setIsAllOpened(i => !i)} size={30}>
            {isAllOpened ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
          </ActionIcon>
        </Tooltip>
      </div>,
    );
  }, [data, filter, setFiltersContext, setFilter, isAllOpened, setIsAllOpened]);

  const businessTransactionsSum = useMemo(() => {
    if (data?.businessTransactionsSumFromLedgerRecords.__typename === 'CommonError') {
      return [];
    }
    if (!data?.businessTransactionsSumFromLedgerRecords.businessTransactionsSum) {
      return [];
    }
    return data.businessTransactionsSumFromLedgerRecords.businessTransactionsSum.sort((a, b) =>
      a.business.name.localeCompare(b.business.name),
    );
  }, [data?.businessTransactionsSumFromLedgerRecords]);

  const columns: Array<{
    title: string | ReactNode;
    disabled?: boolean;
    value: (item: (typeof businessTransactionsSum)[0]) => string | ReactNode;
    style?: React.CSSProperties;
  }> = [
    {
      title: 'Business Name',
      value: data => data.business.name,
    },
    {
      title: 'Debit / Credit',
      value: data => (
        <div className="flex flex-col items-center">
          <p className="flex flex-row gap-2 whitespace-nowrap">
            <Text c="red">{data.debit.formatted}</Text>
          </p>
          <p className="flex flex-row gap-2 whitespace-nowrap">
            <Text c="green">{data.credit.formatted}</Text>
          </p>
        </div>
      ),
      style: { whiteSpace: 'nowrap' },
    },
    {
      title: 'Total',
      value: data => (
        <Text
          c={data.total.raw < -0.0001 ? 'red' : data.total.raw > 0.0001 ? 'green' : undefined}
          fw={700}
        >
          {data.total.formatted}
        </Text>
      ),
      style: { whiteSpace: 'nowrap' },
    },
    {
      title: 'EUR Debit / Credit',
      value: data =>
        data.eurSum ? (
          <div className="flex flex-col items-center">
            <p className="flex flex-row gap-2 whitespace-nowrap">
              <Text c="red">{data.eurSum.debit.formatted}</Text>
            </p>
            <p className="flex flex-row gap-2 whitespace-nowrap">
              <Text c="green">{data.eurSum.credit.formatted}</Text>
            </p>
          </div>
        ) : null,
      style: { whiteSpace: 'nowrap' },
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
      style: { whiteSpace: 'nowrap' },
    },
    {
      title: 'USD Debit / Credit',
      value: data =>
        data.usdSum ? (
          <div className="flex flex-col items-center">
            <p className="flex flex-row gap-2 whitespace-nowrap">
              <Text c="red">{data.usdSum.debit.formatted}</Text>
            </p>
            <p className="flex flex-row gap-2 whitespace-nowrap">
              <Text c="green">{data.usdSum.credit.formatted}</Text>
            </p>
          </div>
        ) : null,
      style: { whiteSpace: 'nowrap' },
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
      style: { whiteSpace: 'nowrap' },
    },
    {
      title: 'GBP Debit / Credit',
      value: data =>
        data.gbpSum ? (
          <div className="flex flex-col items-center">
            <p className="flex flex-row gap-2 whitespace-nowrap">
              <Text c="red">{data.gbpSum.debit.formatted}</Text>
            </p>
            <p className="flex flex-row gap-2 whitespace-nowrap">
              <Text c="green">{data.gbpSum.credit.formatted}</Text>
            </p>
          </div>
        ) : null,
      style: { whiteSpace: 'nowrap' },
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
      style: { whiteSpace: 'nowrap' },
    },
  ];

  return (
    <PageLayout title="Business Transactions" description="Business Transactions Summery">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <Table striped highlightOnHover>
          <thead className="sticky top-0 z-20">
            <tr className="tracking-wider font-medium text-gray-900 text-sm bg-gray-100">
              {columns.map((c, index) =>
                c.disabled ? null : <th key={String(index)}>{c.title}</th>,
              )}
              <th>More Info</th>
            </tr>
          </thead>
          <tbody>
            {businessTransactionsSum.map((item, index) => (
              <AccounterTableRow
                key={index}
                columns={columns}
                item={item}
                moreInfo={() => (
                  <BusinessExtendedInfo businessID={item.business.id} filter={filter} />
                )}
                isShowAll={isAllOpened}
              />
            ))}
          </tbody>
        </Table>
      )}
    </PageLayout>
  );
};
