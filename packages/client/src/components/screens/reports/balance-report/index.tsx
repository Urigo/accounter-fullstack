import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { format, sub } from 'date-fns';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { useQuery } from 'urql';
import {
  BalanceReportScreenDocument,
  BalanceReportScreenQuery,
  Currency,
} from '../../../../gql/graphql.js';
import { getCurrencyFormatter, TimelessDateString } from '../../../../helpers/index.js';
import { useUrlQuery } from '../../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../../providers/filters-context.js';
import { UserContext } from '../../../../providers/user-provider.jsx';
import { AccounterLoader, MultiSelect } from '../../../common/index.js';
import { PageLayout } from '../../../layout/page-layout.jsx';
import { Card, CardContent, CardDescription, CardHeader } from '../../../ui/card.jsx';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../../ui/chart.jsx';
import {
  BALANCE_REPORT_FILTERS_QUERY_PARAM,
  BalanceReportFilter,
  BalanceReportFilters,
  encodeBalanceReportFilters,
  Period,
} from './balance-report-filters.jsx';
import { ExtendedTransactionsCard } from './extended-transactions.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BalanceReportScreen($fromDate: TimelessDate!, $toDate: TimelessDate!, $ownerId: UUID) {
    transactionsForBalanceReport(fromDate: $fromDate, toDate: $toDate, ownerId: $ownerId) {
      id
      amountUsd {
        formatted
        raw
      }
      date
      month
      year
      counterparty {
        id
      }
      isFee
      description
      charge {
        id
        tags {
          id
          name
        }
      }
    }
  }
`;

export function getBalanceReportHref(filter?: BalanceReportFilter | null): string {
  const params = new URLSearchParams();

  const balanceReportFilters = encodeBalanceReportFilters(filter);
  if (balanceReportFilters) {
    // Add it as a single encoded parameter
    params.append(BALANCE_REPORT_FILTERS_QUERY_PARAM, balanceReportFilters);
  }

  const queryParams = params.size > 0 ? `?${params}` : '';
  return `/reports/balance${queryParams}`;
}

const chartConfig = {
  income: {
    label: 'Income',
    color: 'rgba(0, 255, 50, 0.5)',
  },
  expense: {
    label: 'Expense',
    color: 'rgba(255, 0, 0, 0.5)',
  },
  delta: {
    label: 'Delta',
    color: 'rgba(0, 30, 255, 0.5)',
  },
  cumulative: {
    label: 'Cumulative Balance',
    color: 'rgba(100, 0, 255, 0.5)',
  },
} satisfies ChartConfig;

function getPeriodKey(year: number, month: number, period: Period): string {
  switch (period) {
    case Period.MONTHLY: {
      const monthString = String(month).padStart(2, '0');
      return `${year}-${monthString}`;
    }
    case Period.BI_MONTHLY: {
      const firstMonth = month % 2 === 0 ? month - 1 : month;
      const monthString = String(firstMonth).padStart(2, '0');
      return `${year}-${monthString}`;
    }
    case Period.QUARTERLY: {
      const quarter = Math.ceil(month / 3);
      return `${year}-Q${quarter}`;
    }
    case Period.SEMI_ANNUALLY: {
      const half = month > 6 ? 2 : 1;
      return `${year}-H${half}`;
    }
    case Period.ANNUALLY:
      return String(year);
  }
}

function getPeriodLabel(key: string, period: Period): string {
  switch (period) {
    case Period.MONTHLY: {
      const [year, month] = key.split('-');
      return `${month}/${year}`;
    }
    case Period.BI_MONTHLY: {
      const [year, firstMonth] = key.split('-');
      const secondMonthNum = Number(firstMonth) + 1;
      const secondMonth = String(secondMonthNum).padStart(2, '0');

      return `${firstMonth}-${secondMonth}/${year}`;
    }
    case Period.QUARTERLY: {
      const [year, quarter] = key.split('-');
      return `${quarter}, ${year}`;
    }
    case Period.SEMI_ANNUALLY: {
      const [year, half] = key.split('-');
      return `${half}, ${year}`;
    }
    case Period.ANNUALLY:
      return key;
  }
}

const formatter = getCurrencyFormatter(Currency.Usd);

export const BalanceReport = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const { userContext } = useContext(UserContext);
  const { get } = useUrlQuery();
  const initialFilters = useMemo((): BalanceReportFilter => {
    const defaultFilters: BalanceReportFilter = {
      ownerId: userContext?.context.adminBusinessId,
      toDate: format(new Date(), 'yyyy-MM-dd') as TimelessDateString,
      period: Period.MONTHLY,
      fromDate: format(sub(new Date(), { years: 1 }), 'yyyy-MM-dd') as TimelessDateString,
      excludedCounterparties: [],
      includedTags: [],
      excludedTags: [],
    };
    const uriFilters = get(BALANCE_REPORT_FILTERS_QUERY_PARAM);
    if (uriFilters) {
      try {
        return JSON.parse(decodeURIComponent(uriFilters)) as BalanceReportFilter;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        console.log('Error parsing balance report filters from URL:', error);
      }
    }
    return defaultFilters;
  }, [userContext?.context.adminBusinessId]);
  const [filter, setFilter] = useState<BalanceReportFilter>(initialFilters);
  const [extendedPeriod, setExtendedPeriod] = useState<string | undefined>(undefined);
  const [visibleSets, setVisibleSets] = useState<string[]>(Object.keys(chartConfig));

  const variables = useMemo(() => {
    const { ownerId, fromDate, toDate } = filter;
    return { ownerId, fromDate, toDate };
  }, [filter]);

  const [{ data, fetching }] = useQuery({
    query: BalanceReportScreenDocument,
    variables,
    pause: !filter,
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <BalanceReportFilters filter={filter} setFilter={setFilter} initiallyOpened={!filter} />
        <MultiSelect
          options={Object.entries(chartConfig).map(([key, value]) => ({
            label: value.label,
            value: key,
          }))}
          onValueChange={setVisibleSets}
          defaultValue={visibleSets}
          placeholder="Select Data Sets"
          variant="default"
          maxCount={1}
        />
      </div>,
    );
    setExtendedPeriod(undefined);
  }, [data, fetching, filter, setFiltersContext, setFilter, visibleSets]);

  useEffect(() => {
    setFilter(prev => ({
      ...prev,
      ownerId: userContext?.context.adminBusinessId,
    }));
  }, [userContext]);

  const periods = useMemo(() => {
    if (!data?.transactionsForBalanceReport) return [];
    const periods = new Map<
      string,
      {
        income: number;
        expense: number;
        delta: number;
        transactions: BalanceReportScreenQuery['transactionsForBalanceReport'];
      }
    >();
    data.transactionsForBalanceReport.map(txn => {
      if (txn.counterparty?.id) {
        if (
          !txn.isFee &&
          userContext?.context.financialAccountsBusinessesIds?.includes(txn.counterparty.id)
        ) {
          // filter out internal transactions
          return;
        }
        if (filter.excludedCounterparties?.includes(txn.counterparty.id)) {
          // filter out excluded counterparties
          return;
        }
      }
      if (filter.includedTags.length > 0) {
        if (!txn.charge?.tags || txn.charge.tags.length === 0) {
          // filter out transactions without tags
          return;
        }
        if (!txn.charge.tags.some(tag => filter.includedTags.includes(tag.id))) {
          // filter out transactions without included tags
          return;
        }
      }
      if (
        filter.excludedTags.length > 0 &&
        txn.charge?.tags.length &&
        txn.charge.tags.some(tag => filter.excludedTags.includes(tag.id))
      ) {
        // filter out transactions with excluded tags
        return;
      }
      const key = getPeriodKey(txn.year, txn.month, filter.period);
      if (!periods.has(key)) {
        periods.set(key, {
          income: 0,
          expense: 0,
          delta: 0,
          transactions: [],
        });
      }
      const period = periods.get(key)!;
      if (txn.amountUsd.raw > 0) {
        period.income += txn.amountUsd.raw;
      } else {
        period.expense += txn.amountUsd.raw;
      }
      period.delta += txn.amountUsd.raw;
      period.transactions.push(txn);
    });
    let cumulativeBalance = 0;
    return Array.from(periods.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => {
        cumulativeBalance += value.delta;
        return {
          period: key,
          income: value.income,
          expense: value.expense,
          delta: value.delta,
          cumulative: cumulativeBalance,
          transactions: value.transactions.sort(
            (t1, t2) => Math.abs(t2.amountUsd.raw) - Math.abs(t1.amountUsd.raw),
          ),
        };
      });
  }, [
    data,
    filter.period,
    filter.excludedCounterparties,
    userContext?.context.financialAccountsBusinessesIds,
    filter.includedTags,
    filter.excludedTags,
  ]);

  return (
    <PageLayout title="Balance Report" description="Accounts periodical balance">
      {fetching ? (
        <AccounterLoader />
      ) : (
        <>
          <Card className="w-full">
            <CardHeader>
              <CardDescription>
                Click specific period to expand it's transactions data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-150 w-full">
                <BarChart
                  accessibilityLayer
                  data={periods}
                  onClick={e => setExtendedPeriod(e.activeLabel)}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={value => getPeriodLabel(value, filter.period)}
                  />

                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, _item, index) => {
                          const bgColor = `bg-[var(--color-${name})]`;

                          if (index < 2) {
                            return (
                              <>
                                <div className={`${bgColor} h-2.5 w-2.5 shrink-0 rounded-[2px]`} />
                                {chartConfig[name as keyof typeof chartConfig]?.label || name}
                                <div className="ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums text-foreground">
                                  {formatter.format(Number(value))}
                                </div>
                              </>
                            );
                          }
                          return (
                            <div className="mt-1.5 flex basis-full items-center border-t pt-1.5 text-xs font-medium text-foreground">
                              <div
                                className={`h-2.5 w-2.5 shrink-0 rounded-[2px] mr-2 ${bgColor}`}
                              />
                              {chartConfig[name as keyof typeof chartConfig]?.label || name}
                              <div className="ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums text-foreground">
                                {formatter.format(Number(value))}
                              </div>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  {visibleSets.includes('income') && (
                    <Bar dataKey="income" fill="var(--color-income)" radius={4} />
                  )}
                  {visibleSets.includes('expense') && (
                    <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
                  )}
                  {visibleSets.includes('delta') && (
                    <Bar dataKey="delta" fill="var(--color-delta)" radius={4} />
                  )}
                  {visibleSets.includes('cumulative') && (
                    <Bar dataKey="cumulative" fill="var(--color-cumulative)" radius={4} />
                  )}
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          {extendedPeriod && (
            <ExtendedTransactionsCard
              period={extendedPeriod}
              onCloseExtendedTransactions={() => setExtendedPeriod(undefined)}
              transactionIDs={
                periods
                  .find(period => period.period === extendedPeriod)
                  ?.transactions.map(t => t.id) ?? []
              }
            />
          )}
        </>
      )}
    </PageLayout>
  );
};
