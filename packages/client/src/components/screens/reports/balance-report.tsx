import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { format, sub } from 'date-fns';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { useQuery } from 'urql';
import {
  BalanceReportScreenDocument,
  BalanceReportScreenQuery,
  Currency,
} from '../../../gql/graphql.js';
import { getCurrencyFormatter, TimelessDateString } from '../../../helpers/index.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { UserContext } from '../../../providers/user-provider.js';
import { AccounterLoader } from '../../common/index.js';
import { PageLayout } from '../../layout/page-layout.js';
import { Card, CardContent, CardDescription, CardHeader } from '../../ui/card.js';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../ui/chart.js';
import { Toggle } from '../../ui/toggle.js';
import { BalanceReportFilter, BalanceReportFilters, Period } from './balance-report-filters.js';
import { ExtendedTransactionsCard } from './extended-transactions.js';

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
    }
  }
`;

const chartConfig = {
  income: {
    label: 'Income',
    color: 'rgba(0, 255, 50, 0.5)',
  },
  expense: {
    label: 'Expense',
    color: 'rgba(255, 0, 0, 0.5)',
  },
  balance: {
    label: 'Balance',
    color: 'rgba(0, 30, 255, 0.5)',
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
  const [filter, setFilter] = useState<BalanceReportFilter>({
    ownerId: userContext?.context.adminBusinessId,
    toDate: format(new Date(), 'yyyy-MM-dd') as TimelessDateString,
    period: Period.MONTHLY,
    fromDate: format(sub(new Date(), { years: 1 }), 'yyyy-MM-dd') as TimelessDateString,
    excludedCounterparties: [],
  });
  const [extendedPeriod, setExtendedPeriod] = useState<string | undefined>(undefined);
  const [isCumulative, setIsCumulative] = useState<boolean>(true);

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
        <Toggle
          aria-label="Toggle cumulative balance"
          variant="outline"
          onPressedChange={value => setIsCumulative(value)}
        >
          Cumulative Balance
        </Toggle>
      </div>,
    );
    setExtendedPeriod(undefined);
  }, [data, fetching, filter, setFiltersContext, setFilter]);

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
      if (
        txn.counterparty?.id &&
        ((!txn.isFee &&
          userContext?.context.financialAccountsBusinessesIds?.includes(txn.counterparty.id)) ||
          filter.excludedCounterparties?.includes(txn.counterparty.id))
      )
        // filter out internal transactions and excluded counterparties
        return;
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
          balance: isCumulative ? cumulativeBalance : value.delta,
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
    isCumulative,
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
                        formatter={(value, name, item, index) => {
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
                              <div className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-[var(--color-balance)] mr-2" />
                              Balance
                              <div className="ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums text-foreground">
                                {formatter.format(item.payload.balance)}
                              </div>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="income" fill="var(--color-income)" radius={4} />
                  <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
                  <Bar dataKey="balance" fill="var(--color-balance)" radius={4} />
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
