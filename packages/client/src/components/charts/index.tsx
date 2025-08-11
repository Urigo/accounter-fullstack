import { useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import { Decimal } from 'decimal.js';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import {
  Currency,
  IncomeChargesChartDocument,
  type ChargeFilter,
  type IncomeChargesChartQuery,
} from '../../gql/graphql.js';
import type { TimelessDateString } from '../../helpers/dates.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { FIAT_CURRENCIES } from '../business-transactions/index.js';
import { PageLayout } from '../layout/page-layout.js';
import { Card, CardContent, CardHeader, CardTitle } from './cards.js';
import { ChargeFilterFilter } from './chart-filters.js';
import { BarChart } from './chart.js';
import { StatsCard } from './stats-card.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query IncomeChargesChart($filters: ChargeFilter) {
    allCharges(filters: $filters) {
      nodes {
        id
        transactions {
          id
          eventDate
          effectiveDate
          amount {
            currency
            formatted
            raw
          }
          eventExchangeRates {
            aud
            cad
            eur
            gbp
            jpy
            sek
            usd
            date
          }
          debitExchangeRates {
            aud
            cad
            eur
            gbp
            jpy
            sek
            usd
            date
          }
        }
      }
    }
  }
`;

type Transaction = IncomeChargesChartQuery['allCharges']['nodes'][number]['transactions'][number];

export const ChartPage = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const { get } = useUrlQuery();
  const [filter, setFilter] = useState<ChargeFilter>(
    get('ChargeMonthlyChartsFilters')
      ? (JSON.parse(
          decodeURIComponent(get('ChargeMonthlyChartsFilters') as string),
        ) as ChargeFilter)
      : {
          fromDate: '2023-01-01' as TimelessDateString,
          toDate: format(new Date(), 'yyyy-MM-dd') as TimelessDateString,
        },
  );

  const [{ data, fetching, error }] = useQuery({
    query: IncomeChargesChartDocument,
    variables: {
      filters: filter,
    },
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-2">
        <ChargeFilterFilter filter={{ ...filter }} setFilter={setFilter} />
      </div>,
    );
  }, [data, filter, fetching, setFiltersContext, error]);

  function numberToDecimalJS(number: number): number {
    return new Decimal(number).toDP(2).toNumber();
  }

  const overviewData = useMemo(() => {
    const transactions: Array<Transaction> = [];
    data?.allCharges.nodes.map(charge => {
      charge.transactions.map(transaction => {
        // Filter crypto as we're lacking the conversion rates
        if (
          // TODO: implement crypto exchange and add here
          FIAT_CURRENCIES.includes(transaction.amount?.currency)
        ) {
          transactions.push(transaction);
        }
      });
    });

    // For each transaction, get the month, and group by month
    const transactionsByMonth =
      transactions.reduce(
        (acc, transaction) => {
          const date = new Date(transaction.effectiveDate || transaction.eventDate);
          const month = date.toLocaleString('default', { month: 'long' });
          const year = date.getFullYear();
          const key = `${month} ${year}`;
          acc[key] ||= [];
          acc[key].push(transaction);
          return acc;
        },
        {} as Record<string, Array<Transaction>>,
      ) ?? {};

    // for each transaction in the transactionsByMonth, check the currency. If its ILS, EURO, Cad, Jpy, Aud, Sek or GBP, convert to USD. If its USD, do nothing
    const convertedTransactions: Array<{ month: string; converted: Transaction[] }> = [];
    Object.entries(transactionsByMonth).map(([key, value]) => {
      let converted: Array<Transaction | null> = value.map(item => {
        switch (item.amount.currency) {
          case Currency.Usd:
            return item;
          case Currency.Ils: {
            const rate = item.debitExchangeRates?.usd || item.eventExchangeRates?.usd;
            if (!rate) {
              return null;
            }
            const amount = numberToDecimalJS(item.amount.raw * rate);
            return {
              ...item,
              amount: {
                ...item.amount,
                raw: amount,
                currency: Currency.Usd,
                formatted: `$${amount} `,
              },
            };
          }
          case Currency.Eur:
          case Currency.Gbp:
          case Currency.Cad:
          case Currency.Jpy:
          case Currency.Aud:
          case Currency.Sek: {
            const currencyMap: Partial<
              Record<Currency, 'eur' | 'gbp' | 'cad' | 'jpy' | 'aud' | 'sek'>
            > = {
              [Currency.Eur]: 'eur',
              [Currency.Gbp]: 'gbp',
              [Currency.Cad]: 'cad',
              [Currency.Jpy]: 'jpy',
              [Currency.Aud]: 'aud',
              [Currency.Sek]: 'sek',
            };
            const currencyKey = currencyMap[item.amount.currency as Currency];
            if (!currencyKey) {
              return null;
            }
            const rateToILS =
              item.debitExchangeRates?.[currencyKey] || item.eventExchangeRates?.[currencyKey];
            const rateToUSD = item.debitExchangeRates?.usd || item.eventExchangeRates?.usd;
            if (!rateToILS || !rateToUSD) {
              return null;
            }
            const rate = rateToUSD / rateToILS;
            const amount = numberToDecimalJS(item.amount.raw * rate);
            return {
              ...item,
              amount: {
                ...item.amount,
                raw: amount,
                currency: Currency.Usd,
                formatted: `$${amount} `,
              },
            };
          }
        }

        return null;
      });
      converted = converted.filter(item => item !== null);
      convertedTransactions.push({
        month: key,
        converted: converted as Array<Transaction>,
      });
    });

    // for each item in the convertedData array, return the total income and total expenses. Income is when raw is positive, expenses is when raw is negative
    const incomeAndExpenses = convertedTransactions.map(item => {
      const [income, expenses] = item.converted.reduce(
        ([income, expenses], transaction) => {
          if (!transaction.amount.raw) {
            return [income, expenses];
          }
          if (transaction.amount.raw > 0) {
            return [numberToDecimalJS(income + transaction.amount.raw), expenses];
          }
          if (transaction.amount.raw < 0) {
            return [income, numberToDecimalJS(expenses - transaction.amount.raw)];
          }
          return [income, expenses];
        },
        [0, 0],
      );
      return {
        date: item.month,
        income,
        expenses,
      };
    });

    // take the incomeAndExpenses array and sort it by month and return the total income and expenses for month and the month name and year
    return incomeAndExpenses
      .sort((a, b) => {
        const aDate = new Date(a.date);
        const bDate = new Date(b.date);
        return aDate.getTime() - bDate.getTime();
      })
      .map(item => {
        const date = new Date(item.date);
        const month = date.toLocaleString('default', { month: 'long' });
        const year = date.getFullYear();
        return {
          date: month + ' ' + year,
          income: item.income,
          expenses: item.expenses,
        };
      });
  }, [data]);

  const totalIncome = overviewData
    .map(i => i.income)
    .reduce((acc, curr) => numberToDecimalJS(acc + curr), 0);
  const totalExpenses = overviewData
    .map(i => i.expenses)
    .reduce((acc, curr) => numberToDecimalJS(acc + curr), 0);
  const totalBalance = numberToDecimalJS(totalIncome - totalExpenses);

  return (
    <PageLayout title="Charts" description="Income and Expenses">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <>
          <h1 className="text-2xl mb-5 font-medium">
            Data from {filter.fromDate} to {filter.toDate} - Currency: USD
          </h1>
          <StatsCard
            items={[
              {
                title: 'Income',
                number: totalIncome.toLocaleString(),
              },
              {
                title: 'Expenses',
                number: totalExpenses.toLocaleString(),
              },
              {
                title: 'Balance for selected period',
                number: totalBalance.toLocaleString(),
              },
            ]}
          />
          <Card>
            <CardHeader>
              <CardTitle>Income and Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart type="bar" datasetsTitle={['Income', 'Expenses']} data={overviewData} />
            </CardContent>
          </Card>
        </>
      )}
    </PageLayout>
  );
};
