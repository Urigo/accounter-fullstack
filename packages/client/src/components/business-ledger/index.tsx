import { useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import {
  ChevronsLeftRightEllipsis,
  ChevronsRightLeft,
  Loader2,
  PanelTopClose,
  PanelTopOpen,
} from 'lucide-react';
import { useQuery } from 'urql';
import {
  BusinessLedgerRecordsSummeryDocument,
  Currency,
  type BusinessLedgerRecordsSummeryQuery,
  type BusinessTransactionsFilter,
} from '../../gql/graphql.js';
import { FIAT_CURRENCIES } from '../../helpers/index.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { cn } from '../../lib/utils.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { AccounterTableRow, Tooltip } from '../common/index.js';
import { PageLayout } from '../layout/page-layout.js';
import { Button } from '../ui/button.js';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { BusinessExtendedInfo } from './business-extended-info.js';
import { BusinessLedgerRecordsFilters } from './business-ledger-filters.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessLedgerRecordsSummery($filters: BusinessTransactionsFilter) {
    businessTransactionsSumFromLedgerRecords(filters: $filters) {
      ... on BusinessTransactionsSumFromLedgerRecordsSuccessfulResult {
        __typename
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

  const businessTransactionsSum =
    data?.businessTransactionsSumFromLedgerRecords.__typename === 'CommonError'
      ? undefined
      : data?.businessTransactionsSumFromLedgerRecords.businessTransactionsSum;
  const businessLedgerRecordsSum = businessTransactionsSum
    ? [...businessTransactionsSum].sort((a, b) => a.business.name.localeCompare(b.business.name))
    : [];

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
            <span className="text-red-500">{data.debit.formatted}</span>
          </p>
          <p className="flex flex-row gap-2 whitespace-nowrap">
            <span className="text-green-500">{data.credit.formatted}</span>
          </p>
        </div>
      ),
      style: { whiteSpace: 'nowrap' },
    },
    {
      title: 'Total',
      value: data => (
        <div
          className={cn(
            'font-bold',
            data.total.raw < -0.0001
              ? 'text-red-500'
              : data.total.raw > 0.0001
                ? 'text-green-500'
                : undefined,
          )}
        >
          {data.total.formatted}
        </div>
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
        <Table className="[&>tbody>tr:nth-child(odd)]:bg-gray-50">
          <TableHeader className="sticky top-0 z-20">
            <TableRow className="tracking-wider font-medium text-gray-900 text-sm bg-gray-100">
              {columns.map((c, index) =>
                c.disabled ? null : <TableHead key={String(index)}>{c.title}</TableHead>,
              )}
              <TableHead>More Info</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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
          </TableBody>
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
              <span className="text-red-500">{currencySum.debit.formatted}</span>
            </p>
            <p className="flex flex-row gap-2 whitespace-nowrap">
              <span className="text-green-500">{currencySum.credit.formatted}</span>
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
          // Mantine's `Mark` is a <mark> tinted with the colour's 2-shade.
          <mark className={currencySum.total.raw > 0 ? 'bg-green-200' : 'bg-red-200'}>
            {currencySum.total.formatted}
          </mark>
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
