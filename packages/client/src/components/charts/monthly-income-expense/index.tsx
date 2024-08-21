import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import {
  IncomeExpenseChartFilters,
  MonthlyIncomeExpenseChartDocument,
} from '../../../gql/graphql.js';
import type { TimelessDateString } from '../../../helpers/dates.js';
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

export const MonthlyIncomeExpenseChart = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const { get } = useUrlQuery();
  const [filter, setFilter] = useState<IncomeExpenseChartFilters>(
    get('MonthlyIncomeExpenseChartFilters')
      ? (JSON.parse(
          decodeURIComponent(get('MonthlyIncomeExpenseChartFilters') as string),
        ) as IncomeExpenseChartFilters)
      : {
          fromDate: '2023-01-01' as TimelessDateString,
          toDate: format(new Date(), 'yyyy-MM-dd') as TimelessDateString,
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
    const basicDescription = 'Total Income and Expense per Month';
    if (!data?.incomeExpenseChart) {
      return basicDescription;
    }

    return `${basicDescription}, currency ${data.incomeExpenseChart.currency}, ${data.incomeExpenseChart.fromDate.substring(0, 7)} - ${data.incomeExpenseChart.toDate.substring(0, 7)}`;
  }, [data?.incomeExpenseChart]);

  return (
    <PageLayout title="Monthly Income/Expense Chart" description={description}>
      {fetching || !data ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <Chart data={data.incomeExpenseChart} />
      )}
    </PageLayout>
  );
};
