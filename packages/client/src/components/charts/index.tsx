import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import Decimal from 'decimal.js';
import { useQuery } from 'urql';
import { FiltersContext } from '../../filters-context';
import {
  ChargeFilter,
  Currency,
  IncomeChargesChartDocument,
  IncomeChargesChartQuery,
} from '../../gql/graphql.js';
import { TimelessDateString } from '../../helpers/dates';
import { useUrlQuery } from '../../hooks/use-url-query';
import { AccounterLoader } from '../common';
import { Card, CardContent, CardHeader, CardTitle } from './cards';
import { BarChart } from './chart';
import { ChargeFilterFilter } from './chart-filters';
import { StatsCard } from './stats-card';

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
            eur {
              currency
              formatted
              raw
            }
            gbp {
              currency
              formatted
              raw
            }
            usd {
              currency
              formatted
              raw
            }
            date
          }
          debitExchangeRates {
            eur {
              currency
              formatted
              raw
            }
            gbp {
              currency
              formatted
              raw
            }
            usd {
              currency
              formatted
              raw
            }
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
          [Currency.Eur, Currency.Gbp, Currency.Ils, Currency.Usd].includes(
            transaction.amount?.currency,
          )
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

    // for each transaction in the transactionsByMonth, check the currency. If its ILS, EURO or GBP, convert to USD. If its USD, do nothing
    const convertedTransactions: Array<{ month: string; converted: Transaction[] }> = [];
    Object.entries(transactionsByMonth).map(([key, value]) => {
      let converted: Array<Transaction | null> = value.map(item => {
        if (item.amount.currency === Currency.Usd) {
          return item;
        }
        if (item.amount.currency === Currency.Ils) {
          const rate = item.debitExchangeRates?.usd?.raw || item.eventExchangeRates?.usd?.raw;
          if (!rate) {
            console.log(`No rate found for transaction ${item.id}`);
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
        if (item.amount.currency === Currency.Eur) {
          const rateToILS = item.debitExchangeRates?.eur?.raw || item.eventExchangeRates?.eur?.raw;
          const rateToUSD = item.debitExchangeRates?.usd?.raw || item.eventExchangeRates?.usd?.raw;
          if (!rateToILS || !rateToUSD) {
            console.log(`No rate found for transaction ${item.id}`);
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
        if (item.amount.currency === Currency.Gbp) {
          const rateToILS = item.debitExchangeRates?.gbp?.raw || item.eventExchangeRates?.gbp?.raw;
          const rateToUSD = item.debitExchangeRates?.usd?.raw || item.eventExchangeRates?.usd?.raw;
          if (!rateToILS || !rateToUSD) {
            console.log(`No rate found for transaction ${item.id}`);
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
      const [income, outcome] = item.converted.reduce(
        ([income, outcome], transaction) => {
          if (!transaction.amount.raw) {
            return [income, outcome];
          }
          if (transaction.amount.raw > 0) {
            return [numberToDecimalJS(income + transaction.amount.raw), outcome];
          }
          if (transaction.amount.raw < 0) {
            return [income, numberToDecimalJS(outcome - transaction.amount.raw)];
          }
          return [income, outcome];
        },
        [0, 0],
      );
      return {
        date: item.month,
        income,
        outcome,
      };
    });

    // take the incomeAndExpenses array and sort it by month and return the total income and outcome for month and the month name and year
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
          outcome: item.outcome,
        };
      });
  }, [data]);

  if (fetching)
    return (
      <div className="mt-40">
        <AccounterLoader />
      </div>
    );
  // if (error) return <div>Something went wrong!</div>;

  const totalIncome = overviewData
    .map(i => i.income)
    .reduce((acc, curr) => numberToDecimalJS(acc + curr), 0);
  const totalExpenses = overviewData
    .map(i => i.outcome)
    .reduce((acc, curr) => numberToDecimalJS(acc + curr), 0);
  const totalBalance = numberToDecimalJS(totalIncome - totalExpenses);

  return fetching ? (
    <AccounterLoader />
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
            title: 'Outcome',
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
          <CardTitle>Income and Outcome</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart type="bar" datasetsTitle={['Income', 'Outcome']} data={overviewData} />
        </CardContent>
      </Card>
    </>
  );
};
