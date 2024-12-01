import { ReactElement, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useMatch } from 'react-router-dom';
import { useQuery } from 'urql';
import { Table } from '@mantine/core';
import { ProfitAndLossReportDocument } from '../../../gql/graphql.js';
import { dedupeFragments } from '../../../helpers/index.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PageLayout } from '../../layout/page-layout.js';
import { ProfitAndLossReportFilter } from './profit-and-loss-report-filters.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ProfitAndLossReport($reportYear: Int!, $referenceYears: [Int!]!) {
    profitAndLossReport(reportYear: $reportYear, referenceYears: $referenceYears) {
      id
      report {
        id
        year
        revenue {
          amount {
            formatted
          }
        }
        costOfSales {
          amount {
            formatted
          }
        }
        grossProfit {
          formatted
        }
        researchAndDevelopmentExpenses {
          amount {
            formatted
          }
        }
        marketingExpenses {
          amount {
            formatted
          }
        }
        managementAndGeneralExpenses {
          amount {
            formatted
          }
        }
        operatingProfit {
          formatted
        }
        financialExpenses {
          amount {
            formatted
          }
        }
        otherIncome {
          amount {
            formatted
          }
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
      reference {
        id
        year
        revenue {
          amount {
            formatted
          }
        }
        costOfSales {
          amount {
            formatted
          }
        }
        grossProfit {
          formatted
        }
        researchAndDevelopmentExpenses {
          amount {
            formatted
          }
        }
        marketingExpenses {
          amount {
            formatted
          }
        }
        managementAndGeneralExpenses {
          amount {
            formatted
          }
        }
        operatingProfit {
          formatted
        }
        financialExpenses {
          amount {
            formatted
          }
        }
        otherIncome {
          amount {
            formatted
          }
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
  }
`;

export const ProfitAndLossReport = (): ReactElement => {
  const match = useMatch('/reports/profit-and-loss/:year');
  const { setFiltersContext } = useContext(FiltersContext);
  const [year, setYear] = useState<number>(
    (match ? Number(match.params.year) : undefined) ?? new Date().getFullYear(),
  );
  const [referenceYears, setReferenceYears] = useState<number[]>([]);

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: dedupeFragments(ProfitAndLossReportDocument),
    variables: {
      reportYear: year,
      referenceYears,
    },
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-2">
        <ProfitAndLossReportFilter
          year={year}
          setYear={setYear}
          referenceYears={referenceYears}
          setReferenceYears={setReferenceYears}
        />
      </div>,
    );
  }, [year, fetching, setFiltersContext, referenceYears, setReferenceYears]);

  const yearlyReports = data?.profitAndLossReport;
  const report = yearlyReports?.report;
  const referenceYearsData = yearlyReports?.reference ?? [];

  return (
    <PageLayout title="Profit and Loss Report">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <div className="flex flex-col gap-4">
          {report && (
            <Table highlightOnHover fontSize="md">
              <thead>
                <tr>
                  <th />
                  <th key={year}>{year}</th>
                  {referenceYearsData.map(report => (
                    <th key={report.year}>{report.year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Revenue</th>
                  <th>{report.revenue.amount.formatted}</th>
                  {referenceYearsData.map(report => (
                    <th key={report.year}>{report.revenue.amount.formatted}</th>
                  ))}
                </tr>
                <tr>
                  <td>Cost of Sales</td>
                  <td>{report.costOfSales.amount.formatted}</td>
                  {referenceYearsData.map(report => (
                    <td key={report.year}>{report.costOfSales.amount.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <th>Gross Profit</th>
                  <th>{report.grossProfit.formatted}</th>
                  {referenceYearsData.map(report => (
                    <th key={report.year}>{report.grossProfit.formatted}</th>
                  ))}
                </tr>
                <tr>
                  <td>R&D Expenses</td>
                  <td>{report.researchAndDevelopmentExpenses.amount.formatted}</td>
                  {referenceYearsData.map(report => (
                    <td key={report.year}>
                      {report.researchAndDevelopmentExpenses.amount.formatted}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Marketing Expenses</td>
                  <td>{report.marketingExpenses.amount.formatted}</td>
                  {referenceYearsData.map(report => (
                    <td key={report.year}>{report.marketingExpenses.amount.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <td>Management and General Expenses</td>
                  <td>{report.managementAndGeneralExpenses.amount.formatted}</td>
                  {referenceYearsData.map(report => (
                    <td key={report.year}>
                      {report.managementAndGeneralExpenses.amount.formatted}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>Operating Profit</th>
                  <th>{report.operatingProfit.formatted}</th>
                  {referenceYearsData.map(report => (
                    <th key={report.year}>{report.operatingProfit.formatted}</th>
                  ))}
                </tr>
                <tr>
                  <td>Financial Expenses</td>
                  <td>{report.financialExpenses.amount.formatted}</td>
                  {referenceYearsData.map(report => (
                    <td key={report.year}>{report.financialExpenses.amount.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <td>Other Income</td>
                  <td>{report.otherIncome.amount.formatted}</td>
                  {referenceYearsData.map(report => (
                    <td key={report.year}>{report.otherIncome.amount.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <th>Profit Before Tax</th>
                  <th>{report.profitBeforeTax.formatted}</th>
                  {referenceYearsData.map(report => (
                    <th key={report.year}>{report.profitBeforeTax.formatted}</th>
                  ))}
                </tr>
                <tr>
                  <td>Tax</td>
                  <td>{report.tax.formatted}</td>
                  {referenceYearsData.map(report => (
                    <td key={report.year}>{report.tax.formatted}</td>
                  ))}
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th>Net Profit</th>
                  <th>{report.netProfit.formatted}</th>
                  {referenceYearsData.map(report => (
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
