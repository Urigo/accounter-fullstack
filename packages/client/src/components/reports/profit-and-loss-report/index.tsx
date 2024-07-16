import { ReactElement, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useMatch } from 'react-router-dom';
import { useQuery } from 'urql';
import { Table } from '@mantine/core';
import { ProfitAndLossReportDocument } from '../../../gql/graphql.js';
import { dedupeFragments } from '../../../helpers';
import { FiltersContext } from '../../../providers/filters-context';
import { PageLayout } from '../../layout/page-layout.js';
import { ProfitAndLossReportFilter } from './profit-and-loss-report-filters.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ProfitAndLossReport($years: [Int!]!) {
    profitAndLossReport(years: $years) {
      year
      revenue {
        formatted
      }
      costOfSales {
        formatted
      }
      grossProfit {
        formatted
      }
      researchAndDevelopmentExpenses {
        formatted
      }
      marketingExpenses {
        formatted
      }
      managementAndGeneralExpenses {
        formatted
      }
      operatingProfit {
        formatted
      }
      financialExpenses {
        formatted
      }
      otherIncome {
        formatted
      }
      profitBeforeTax {
        formatted
      }
      tax {
        formatted
      }
      netProfit {
        formatted
      }
    }
  }
`;

export const ProfitAndLossReport = (): ReactElement => {
  const match = useMatch('/reports/profit-and-loss/:year');
  const { setFiltersContext } = useContext(FiltersContext);
  const [years, setYears] = useState<number[]>(
    (match ? [Number(match.params.year)] : undefined) ?? [new Date().getFullYear()],
  );

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: dedupeFragments(ProfitAndLossReportDocument),
    variables: {
      years,
    },
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-2">
        <ProfitAndLossReportFilter years={years} setYears={setYears} />
      </div>,
    );
  }, [years, fetching, setFiltersContext]);

  const yearlyReports = data?.profitAndLossReport ?? [];

  return (
    <PageLayout title="Profit and Loss Report">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <div className="flex flex-col gap-4">
          {yearlyReports && (
            <Table highlightOnHover fontSize="md">
              <thead>
                <tr>
                  <th />
                  {years.map(year => (
                    <th key={year}>{year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Revenue</th>
                  {yearlyReports.map(report => (
                    <th key={report.year}>{report.revenue.formatted}</th>
                  ))}
                </tr>
                <tr>
                  <td>Cost of Sales</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{report.costOfSales.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <th>Gross Profit</th>
                  {yearlyReports.map(report => (
                    <th key={report.year}>{report.grossProfit.formatted}</th>
                  ))}
                </tr>
                <tr>
                  <td>R&D Expenses</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{report.researchAndDevelopmentExpenses.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <td>Marketing Expenses</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{report.marketingExpenses.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <td>Management and General Expenses</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{report.managementAndGeneralExpenses.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <th>Operating Profit</th>
                  {yearlyReports.map(report => (
                    <th key={report.year}>{report.operatingProfit.formatted}</th>
                  ))}
                </tr>
                <tr>
                  <td>Financial Expenses</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{report.financialExpenses.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <td>Other Income</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{report.otherIncome.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <th>Profit Before Tax</th>
                  {yearlyReports.map(report => (
                    <th key={report.year}>{report.profitBeforeTax.formatted}</th>
                  ))}
                </tr>
                <tr>
                  <td>Tax</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{report.tax.formatted}</td>
                  ))}
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th>Net Profit</th>
                  {yearlyReports.map(report => (
                    <th key={report.year}>{report.netProfit.formatted}</th>
                  ))}
                </tr>
              </tfoot>
            </Table>
          )}
        </div>
      )}
    </PageLayout>
  );
};
