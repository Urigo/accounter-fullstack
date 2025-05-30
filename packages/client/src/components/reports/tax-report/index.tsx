import { ReactElement, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useMatch } from 'react-router-dom';
import { useQuery } from 'urql';
import { Table } from '@mantine/core';
import { TaxReportDocument } from '../../../gql/graphql.js';
import { dedupeFragments } from '../../../helpers/index.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PageLayout } from '../../layout/page-layout.js';
import { ReportCommentaryRow } from '../shared/report-commentary-row.js';
import { TaxReportFilter } from './tax-report-filters.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query TaxReport($reportYear: Int!, $referenceYears: [Int!]!) {
    taxReport(reportYear: $reportYear, referenceYears: $referenceYears) {
      id
      report {
        id
        year
        profitBeforeTax {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
        }
        researchAndDevelopmentExpensesByRecords {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
        }
        researchAndDevelopmentExpensesForTax {
          formatted
        }
        fines {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
        }
        untaxableGifts {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
        }
        businessTripsExcessExpensesAmount {
          formatted
        }
        salaryExcessExpensesAmount {
          formatted
        }
        reserves {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
        }
        nontaxableLinkage {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
        }
        taxableIncome {
          formatted
        }
        taxRate
        specialTaxableIncome {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
        }
        specialTaxRate
        annualTaxExpense {
          formatted
        }
      }
      reference {
        id
        year
        profitBeforeTax {
          amount {
            formatted
          }
        }
        researchAndDevelopmentExpensesByRecords {
          amount {
            formatted
          }
        }
        researchAndDevelopmentExpensesForTax {
          formatted
        }
        fines {
          amount {
            formatted
          }
        }
        untaxableGifts {
          amount {
            formatted
          }
        }
        businessTripsExcessExpensesAmount {
          formatted
        }
        salaryExcessExpensesAmount {
          formatted
        }
        reserves {
          amount {
            formatted
          }
        }
        nontaxableLinkage {
          amount {
            formatted
          }
        }
        taxableIncome {
          formatted
        }
        taxRate
        specialTaxableIncome {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
        }
        specialTaxRate
        annualTaxExpense {
          formatted
        }
      }
    }
  }
`;

export const TaxReport = (): ReactElement => {
  const match = useMatch('/reports/tax/:year');
  const { setFiltersContext } = useContext(FiltersContext);
  const [year, setYear] = useState<number>(
    (match ? Number(match.params.year) : undefined) ?? new Date().getFullYear(),
  );
  const [referenceYears, setReferenceYears] = useState<number[]>([]);

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: dedupeFragments(TaxReportDocument),
    variables: {
      reportYear: year,
      referenceYears,
    },
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-2">
        <TaxReportFilter
          year={year}
          setYear={setYear}
          referenceYears={referenceYears}
          setReferenceYears={setReferenceYears}
        />
      </div>,
    );
  }, [year, fetching, setFiltersContext, referenceYears, setReferenceYears]);

  const yearlyReports = data?.taxReport;
  const report = yearlyReports?.report;
  const referenceYearsData = yearlyReports?.reference ?? [];

  return (
    <PageLayout title="Tax Report">
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
                  <th />
                  {referenceYearsData.map(report => (
                    <th key={report.year}>{report.year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <ReportCommentaryRow
                  dataRow={button => (
                    <tr>
                      <th>Profit Before Tax</th>
                      <th>{report.profitBeforeTax.amount.formatted}</th>
                      <th>{button}</th>
                      {referenceYearsData.map(report => (
                        <th key={report.year}>{report.profitBeforeTax.amount.formatted}</th>
                      ))}
                    </tr>
                  )}
                  commentaryData={report.profitBeforeTax}
                />
                <ReportCommentaryRow
                  dataRow={button => (
                    <tr>
                      <td>R&D Expenses By Records</td>
                      <td>{report.researchAndDevelopmentExpensesByRecords.amount.formatted}</td>
                      <th>{button}</th>
                      {referenceYearsData.map(report => (
                        <td key={report.year}>
                          {report.researchAndDevelopmentExpensesByRecords.amount.formatted}
                        </td>
                      ))}
                    </tr>
                  )}
                  commentaryData={report.researchAndDevelopmentExpensesByRecords}
                />
                <tr>
                  <td>R&D Expenses For Tax</td>
                  <td>{report.researchAndDevelopmentExpensesForTax.formatted}</td>
                  <td />
                  {referenceYearsData.map(report => (
                    <td key={report.year}>
                      {report.researchAndDevelopmentExpensesForTax.formatted}
                    </td>
                  ))}
                  <td />
                </tr>
                <ReportCommentaryRow
                  dataRow={button => (
                    <tr>
                      <td>Fines</td>
                      <td>{report.fines.amount.formatted}</td>
                      <th>{button}</th>
                      {referenceYearsData.map(report => (
                        <td key={report.year}>{report.fines.amount.formatted}</td>
                      ))}
                    </tr>
                  )}
                  commentaryData={report.fines}
                />
                <ReportCommentaryRow
                  dataRow={button => (
                    <tr>
                      <td>Untaxable Gifts</td>
                      <td>{report.untaxableGifts.amount.formatted}</td>
                      <th>{button}</th>
                      {referenceYearsData.map(report => (
                        <td key={report.year}>{report.untaxableGifts.amount.formatted}</td>
                      ))}
                    </tr>
                  )}
                  commentaryData={report.untaxableGifts}
                />
                <tr>
                  <td>Business Trips Excess Expenses</td>
                  <td>{report.businessTripsExcessExpensesAmount.formatted}</td>
                  <td />
                  {referenceYearsData.map(report => (
                    <td key={report.year}>{report.businessTripsExcessExpensesAmount.formatted}</td>
                  ))}
                  <td />
                </tr>
                <tr>
                  <td>Salary Excess Expenses</td>
                  <td>{report.salaryExcessExpensesAmount.formatted}</td>
                  <td />
                  {referenceYearsData.map(report => (
                    <td key={report.year}>{report.salaryExcessExpensesAmount.formatted}</td>
                  ))}
                  <td />
                </tr>
                <ReportCommentaryRow
                  dataRow={button => (
                    <tr>
                      <td>Reserves</td>
                      <td>{report.reserves.amount.formatted}</td>
                      <th>{button}</th>
                      {referenceYearsData.map(report => (
                        <td key={report.year}>{report.reserves.amount.formatted}</td>
                      ))}
                    </tr>
                  )}
                  commentaryData={report.reserves}
                />
                <ReportCommentaryRow
                  dataRow={button => (
                    <tr>
                      <td>Nontaxable Linkage</td>
                      <td>{report.nontaxableLinkage.amount.formatted}</td>
                      <th>{button}</th>
                      {referenceYearsData.map(report => (
                        <td key={report.year}>{report.nontaxableLinkage.amount.formatted}</td>
                      ))}
                    </tr>
                  )}
                  commentaryData={report.nontaxableLinkage}
                />
                <tr>
                  <th>Taxable Income</th>
                  <th>{report.taxableIncome.formatted}</th>
                  <th />
                  {referenceYearsData.map(report => (
                    <th key={report.year}>{report.taxableIncome.formatted}</th>
                  ))}
                  <td />
                </tr>
                <tr>
                  <td>Tax Rate</td>
                  <td>{(report.taxRate * 100).toFixed(1)}%</td>
                  <td />
                  {referenceYearsData.map(report => (
                    <td key={report.year}>{(report.taxRate * 100).toFixed(1)}%</td>
                  ))}
                  <td />
                </tr>

                <ReportCommentaryRow
                  dataRow={button => (
                    <tr>
                      <td>Income with Special Tax Rate</td>
                      <td>{report.specialTaxableIncome.amount.formatted}</td>
                      <th>{button}</th>
                      {referenceYearsData.map(report => (
                        <td key={report.year}>{report.specialTaxableIncome.amount.formatted}</td>
                      ))}
                    </tr>
                  )}
                  commentaryData={report.specialTaxableIncome}
                />
                <tr>
                  <td>Special Tax Rate</td>
                  <td>{(report.specialTaxRate * 100).toFixed(1)}%</td>
                  <td />
                  {referenceYearsData.map(report => (
                    <td key={report.year}>{(report.specialTaxRate * 100).toFixed(1)}%</td>
                  ))}
                  <td />
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th>Annual Tax Expense</th>
                  <th>{report.annualTaxExpense.formatted}</th>
                  <th />
                  {referenceYearsData.map(report => (
                    <th key={report.year}>{report.annualTaxExpense.formatted}</th>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </Table>
          )}
        </div>
      )}
    </PageLayout>
  );
};
