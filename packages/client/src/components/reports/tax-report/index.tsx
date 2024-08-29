import { ReactElement, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useMatch } from 'react-router-dom';
import { useQuery } from 'urql';
import { Table } from '@mantine/core';
import { TaxReportDocument } from '../../../gql/graphql.js';
import { dedupeFragments } from '../../../helpers/index.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PageLayout } from '../../layout/page-layout.js';
import { TaxReportFilter } from './tax-report-filters.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query TaxReport($years: [Int!]!) {
    taxReport(years: $years) {
      year
      profitBeforeTax {
        formatted
      }
      researchAndDevelopmentExpensesByRecords {
        formatted
      }
      researchAndDevelopmentExpensesForTax {
        formatted
      }
      deprecationForTax {
        formatted
      }
      taxableIncome {
        formatted
      }
      taxRate
      annualTaxExpense {
        formatted
      }
    }
  }
`;

export const TaxReport = (): ReactElement => {
  const match = useMatch('/reports/tax/:year');
  const { setFiltersContext } = useContext(FiltersContext);
  const [years, setYears] = useState<number[]>(
    (match ? [Number(match.params.year)] : undefined) ?? [new Date().getFullYear()],
  );

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: dedupeFragments(TaxReportDocument),
    variables: {
      years,
    },
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-2">
        <TaxReportFilter years={years} setYears={setYears} />
      </div>,
    );
  }, [years, fetching, setFiltersContext]);

  const yearlyReports = data?.taxReport ?? [];

  return (
    <PageLayout title="Tax Report">
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
                  <th>Profit Before Tax</th>
                  {yearlyReports.map(report => (
                    <th key={report.year}>{report.profitBeforeTax.formatted}</th>
                  ))}
                </tr>
                <tr>
                  <td>R&D Expenses By Records</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>
                      {report.researchAndDevelopmentExpensesByRecords.formatted}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>R&D Expenses For Tax</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>
                      {report.researchAndDevelopmentExpensesForTax.formatted}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Deprecations For Tax</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{report.deprecationForTax.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <th>Taxable Income</th>
                  {yearlyReports.map(report => (
                    <th key={report.year}>{report.taxableIncome.formatted}</th>
                  ))}
                </tr>
                <tr>
                  <td>Tax Rate</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{(report.taxRate * 100).toFixed(1)}%</td>
                  ))}
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th>Annual Tax Expense</th>
                  {yearlyReports.map(report => (
                    <th key={report.year}>{report.annualTaxExpense.formatted}</th>
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
