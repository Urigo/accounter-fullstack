import { useContext, useEffect, useState } from 'react';
import { format } from 'date-fns';
import Decimal from 'decimal.js';
import { useQuery } from 'urql';
import { FiltersContext } from '../../filters-context';
import {
  ChargeFilter,
  Currency,
  IncomeChargesChartDocument,
  IncomeChargesChartQuery,
} from '../../gql/graphql';
import { TimelessDateString } from '../../helpers/dates';
import { useUrlQuery } from '../../hooks/use-url-query';
import { AccounterLoader } from '../common';
import { Card, CardContent, CardHeader, CardTitle } from './cards';
import { BarChart } from './chart';
import { ChargeFilterFilter } from './chart-filters';
import { StatsCard } from './stats-card';

/* GraphQL */ `
query IncomeChargesChart($filters: ChargeFilter) {
    allCharges(filters: $filters) {
      nodes {
        transactions {
          id
          createdAt
        }
        currencyRatesAmount {
        id
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
      id
      totalAmount {
        currency
        formatted
        raw
      }
    }
    }
  }
`;

export const ChartPage = () => {
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

  if (!data)
    return (
      <div className="mt-40">
        <AccounterLoader />
      </div>
    );
  if (error) return <div>Something went wrong!</div>;

  function numberToDecimalJS(number: number) {
    return new Decimal(number).toDP(2).toNumber();
  }

  // For each item in the array, get the month, and group by month
  const groupedByMonth = data.allCharges.nodes.reduce((acc, curr) => {
    const date = new Date(curr.transactions[0].createdAt);
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    const key = `${month} ${year}`;
    acc[key] ||= [];
    acc[key].push(curr);
    return acc;
  }, {} as Record<string, IncomeChargesChartQuery['allCharges']['nodes']>);

  // for each item in the groupedByMonth array, check the currency. If its ILS or EURO, convert to USD. If its USD, do nothing

  const convertedData = Object.entries(groupedByMonth).map(([key, value]) => {
    const converted = value.map(item => {
      if (item.totalAmount?.currency === 'USD') {
        return item;
      }
      if (item.totalAmount?.currency === 'GRT' && item.currencyRatesAmount?.usd) {
        return {
          ...item,
          totalAmount: {
            ...item.totalAmount,
            raw: numberToDecimalJS(item.totalAmount.raw * item.currencyRatesAmount?.usd?.raw),
            currency: Currency.Usd,
            formatted: `$${numberToDecimalJS(
              item.totalAmount.raw * item.currencyRatesAmount.usd.raw,
            )} `,
          },
        };
      }
      if (item.totalAmount?.currency === 'ILS' && item.currencyRatesAmount?.usd) {
        return {
          ...item,
          totalAmount: {
            ...item.totalAmount,
            raw: numberToDecimalJS(item.totalAmount.raw * item.currencyRatesAmount?.usd?.raw),
            currency: Currency.Usd,
            formatted: `$${numberToDecimalJS(
              item.totalAmount.raw * item.currencyRatesAmount.usd.raw,
            )} `,
          },
        };
      }
      if (item.totalAmount?.currency === 'EUR' && item.currencyRatesAmount?.usd) {
        return {
          ...item,
          totalAmount: {
            ...item.totalAmount,
            raw: numberToDecimalJS(item.totalAmount.raw * item.currencyRatesAmount?.usd?.raw),
            currency: Currency.Usd,
            formatted: `$${numberToDecimalJS(
              item.totalAmount.raw * item.currencyRatesAmount.usd.raw,
            )} `,
          },
        };
      }
      return item;
    });
    return {
      month: key,
      converted,
    };
  });

  // for each item in the convertedData array, return the total income and total expenses. Income is when raw is positive, expenses is when raw is negative
  const incomeAndExpenses = convertedData.map(item => {
    const income = item.converted.reduce((acc, curr) => {
      if (!curr.totalAmount?.raw) {
        return numberToDecimalJS(acc);
      }
      if (curr.totalAmount?.raw > 0) {
        return numberToDecimalJS(acc + curr.totalAmount.raw);
      }
      return numberToDecimalJS(acc);
    }, 0);
    const outcome = item.converted.reduce((acc, curr) => {
      if (!curr.totalAmount?.raw) {
        return numberToDecimalJS(acc);
      }
      if (curr.totalAmount?.raw < 0) {
        return numberToDecimalJS(acc - curr.totalAmount.raw);
      }
      return numberToDecimalJS(acc);
    }, 0);
    return {
      date: item.month,
      income,
      outcome,
    };
  });

  // take the incomeAndExpenses array and sort it by month and return the total income and outcome for month and the month name and year
  const overviewData = incomeAndExpenses
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
            number: totalIncome.toLocaleString() as string,
          },
          {
            title: 'Outcome',
            number: totalExpenses.toLocaleString() as string,
          },
          {
            title: 'Balance for selected period',
            number: totalBalance.toLocaleString() as string,
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
