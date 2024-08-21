import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { format, sub } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import {
  IncomeExpenseChartFilters,
  MonthlyIncomeExpenseChartDocument,
} from '../../../gql/graphql.js';
import { currencyCodeToSymbol, type TimelessDateString } from '../../../helpers/index.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PageLayout } from '../../layout/page-layout.js';
import { ChartFilter } from './chart-filter.js';
import { Chart } from './chart.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query MonthlyIncomeExpenseChart($filters: IncomeExpenseChartFilters!) {
    incomeExpenseChart(filters: $filters) {
      fromDate
      toDate
      currency
      ...MonthlyIncomeExpenseChartInfo
    }
  }
`;

const defaultToDate = format(sub(new Date(), { months: 2 }), 'yyyy-MM-dd') as TimelessDateString; // past month
const defaultFromDate = format(
  sub(new Date(), { years: 1, months: 1 }),
  'yyyy-MM-dd',
) as TimelessDateString; // past year

export const MonthlyIncomeExpenseChart = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const { get } = useUrlQuery();
  const [filter, setFilter] = useState<IncomeExpenseChartFilters>(
    get('MonthlyIncomeExpenseChartFilters')
      ? (JSON.parse(
          decodeURIComponent(get('MonthlyIncomeExpenseChartFilters') as string),
        ) as IncomeExpenseChartFilters)
      : {
          fromDate: defaultFromDate,
          toDate: defaultToDate,
        },
  );

  const [{ data, fetching, error }] = useQuery({
    query: MonthlyIncomeExpenseChartDocument,
    variables: {
      filters: filter,
    },
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-2">
        <ChartFilter filter={{ ...filter }} setFilter={setFilter} />
      </div>,
    );
  }, [data, filter, fetching, setFiltersContext, error]);

  const description = useMemo(() => {
    const basicDescription = 'Total Income and Expense';
    if (!data?.incomeExpenseChart) {
      return basicDescription + ' per Month';
    }

    return `${basicDescription}, currency ${currencyCodeToSymbol(data.incomeExpenseChart.currency)}, ${format(new Date(data.incomeExpenseChart.fromDate), "MMM ''yy")} - ${format(new Date(data.incomeExpenseChart.toDate), "MMM ''yy")}`;
  }, [data?.incomeExpenseChart]);

  return (
    <PageLayout title="Monthly Income / Expense Chart" description={description}>
      {fetching || !data ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <Chart data={data.incomeExpenseChart} />
      )}
    </PageLayout>
  );
};
