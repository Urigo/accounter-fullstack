import React, { useMemo } from 'react';
import { BarChart, type BarSeriesType } from '@mui/x-charts';
import { MonthlyIncomeExpenseChartInfoFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment MonthlyIncomeExpenseChartInfo on IncomeExpenseChart {
    monthlyData {
      income {
        formatted
        raw
      }
      expense {
        formatted
        raw
      }
      balance {
        formatted
        raw
      }
      date
    }
  }
`;

interface BarChartProps {
  data: FragmentType<typeof MonthlyIncomeExpenseChartInfoFragmentDoc>;
}

export const Chart: React.FC<BarChartProps> = ({ data }) => {
  const { monthlyData } = getFragmentData(MonthlyIncomeExpenseChartInfoFragmentDoc, data);

  const labels = monthlyData.map(month => month.date.substring(0, 7));
  const series: Omit<BarSeriesType, 'type'>[] = useMemo(() => {
    const incomeData = [];
    const expenseData = [];
    const balanceData = [];
    const cumulativeBalanceData = [];
    for (const month of monthlyData) {
      incomeData.push(month.income.raw);
      expenseData.push(-month.expense.raw);
      balanceData.push(month.income.raw - month.expense.raw);
      cumulativeBalanceData.push(month.balance.raw);
    }
    return [
      { data: incomeData, label: 'Income', highlightScope, color: '#4caf50', stack: 'stack1' },
      { data: expenseData, label: 'Expense', highlightScope, color: '#f44336', stack: 'stack1' },
      {
        data: balanceData,
        label: 'Month Balance',
        highlightScope,
        color: '#8658a4',
        stack: 'stack2',
      },
      {
        data: cumulativeBalanceData,
        label: 'Cumulative Balance',
        highlightScope,
        color: '#2196f3',
        stack: 'stack3',
      },
    ];
  }, [monthlyData]);
  return (
    <BarChart
      skipAnimation
      series={series}
      height={290}
      xAxis={[
        {
          data: labels,
          scaleType: 'band',
        },
      ]}
      margin={{ top: 10, bottom: 30, left: 40, right: 10 }}
      borderRadius={3}
    />
  );
};

const highlightScope = {
  highlighted: 'series',
  faded: 'global',
} as const;
