import { useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import {
  ChevronsLeftRightEllipsis,
  ChevronsRightLeft,
  Loader2,
  PanelTopClose,
  PanelTopOpen,
} from 'lucide-react';
import { useQuery } from 'urql';
import { Mark, Table, Text } from '@mantine/core';
import {
  BusinessLedgerRecordsSummeryDocument,
  Currency,
  type BusinessLedgerRecordsSummeryQuery,
  type BusinessTransactionsFilter,
} from '../../gql/graphql.js';
import { FIAT_CURRENCIES } from '../../helpers/index.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { AccounterTableRow, Tooltip } from '../common/index.js';
import { PageLayout } from '../layout/page-layout.js';
import { Button } from '../ui/button.js';
import { BusinessExtendedInfo } from './business-extended-info.js';
import { BusinessLedgerRecordsFilters } from './business-ledger-filters.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessLedgerRecordsSummery($filters: BusinessTransactionsFilter) {
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
          foreignCurrenciesSum {
            currency
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

type BusinessLedgerRecordsSum = Extract<
  BusinessLedgerRecordsSummeryQuery['businessTransactionsSumFromLedgerRecords'],
  { businessTransactionsSum: unknown }
>['businessTransactionsSum'][number];

type CellInfo = {
  title: string | ReactNode;
  disabled?: boolean;
  value: (item: BusinessLedgerRecordsSum) => string | ReactNode;
  style?: React.CSSProperties;
};

export const BusinessLedgerRecordsSummery = (): ReactElement => {
  const { get } = useUrlQuery();
  const { setFiltersContext } = useContext(FiltersContext);
  const [isAllOpened, setIsAllOpened] = useState<boolean>(false);
  const [isExpandedCurrencies, setIsExpandedCurrencies] = useState<boolean>(false);
  const [filter, setFilter] = useState<BusinessTransactionsFilter>(
    get('ledgerRecordsFilters')
      ? (JSON.parse(
          decodeURIComponent(get('ledgerRecordsFilters') as string),
        ) as BusinessTransactionsFilter)
      : {},
  );
  const [{ data, fetching }] = useQuery({
    query: BusinessLedgerRecordsSummeryDocument,
    variables: {
      filters: filter,
    },
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <BusinessLedgerRecordsFilters filter={filter} setFilter={setFilter} />
        <Tooltip content="Expand all accounts" asChild>
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
        <Tooltip content="Expand all currencies" asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-7.5"
            onClick={(): void => setIsExpandedCurrencies(i => !i)}
          >
            {isExpandedCurrencies ? (
              <ChevronsRightLeft className="size-5" />
            ) : (
              <ChevronsLeftRightEllipsis className="size-5" />
            )}
          </Button>
        </Tooltip>
      </div>,
    );
  }, [
    data,
    filter,
    setFiltersContext,
    setFilter,
    isAllOpened,
    setIsAllOpened,
    isExpandedCurrencies,
  ]);

  const businessLedgerRecordsSum = useMemo(() => {
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

  const columns: Array<CellInfo> = [
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
    ...getCurrencyCells(Currency.Eur),
    ...getCurrencyCells(Currency.Usd),
    ...getCurrencyCells(Currency.Gbp),
    ...getCurrencyCells(Currency.Cad),
    ...getCurrencyCells(Currency.Jpy),
    ...getCurrencyCells(Currency.Aud),
    ...getCurrencyCells(Currency.Sek),
    ...getExtendedCurrencies(isExpandedCurrencies),
  ];

  return (
    <PageLayout title="Business Ledger Records" description="Business Ledger Records Summary">
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
            {businessLedgerRecordsSum.map((item, index) => (
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

function getCurrencyCells(currency: Currency): CellInfo[] {
  return [
    {
      title: `${currency} Debit / Credit`,
      value: (data): ReactNode => {
        const currencySum = data.foreignCurrenciesSum.find(c => c.currency === currency);
        return currencySum ? (
          <div className="flex flex-col items-center">
            <p className="flex flex-row gap-2 whitespace-nowrap">
              <Text c="red">{currencySum.debit.formatted}</Text>
            </p>
            <p className="flex flex-row gap-2 whitespace-nowrap">
              <Text c="green">{currencySum.credit.formatted}</Text>
            </p>
          </div>
        ) : null;
      },
      style: { whiteSpace: 'nowrap' },
    },
    {
      title: `${currency} Total`,
      value: (data): ReactNode => {
        const currencySum = data.foreignCurrenciesSum.find(c => c.currency === currency);

        return currencySum?.total?.raw &&
          (currencySum.total.raw < -0.0001 || currencySum.total.raw > 0.0001) ? (
          <Mark color={currencySum.total.raw > 0 ? 'green' : 'red'}>
            {currencySum.total.formatted}
          </Mark>
        ) : (
          currencySum?.total?.formatted
        );
      },
      style: { whiteSpace: 'nowrap' },
    },
  ];
}

function getExtendedCurrencies(isExpandedCurrencies: boolean): CellInfo[] {
  if (!isExpandedCurrencies) {
    return [];
  }

  const currenciesToExtend = Object.values(Currency).filter(
    currency => !FIAT_CURRENCIES.includes(currency),
  );

  return currenciesToExtend.map(getCurrencyCells).flat();
}
