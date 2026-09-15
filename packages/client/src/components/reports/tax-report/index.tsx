import { useContext, useEffect, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'urql';
import { TaxReportDocument } from '../../../gql/graphql.js';
import { dedupeFragments } from '../../../helpers/index.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PrintToPdfButton } from '../../common/index.js';
import { PageLayout } from '../../layout/page-layout.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { ReportCommentaryRow } from '../shared/report-commentary-row.js';
import { TaxReportFilter } from './tax-report-filters.js';

// Hoisted, matching `vat-monthly-report/index.tsx`: `dedupeFragments` builds a new
// `DocumentNode` on every call, so doing it inline re-printed and re-hashed the
// document on each render just to arrive at the same operation key.
const taxReportQuery = dedupeFragments(TaxReportDocument);

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
  const { year: yearFromUrl } = useParams<{ year: string }>();
  const { setFiltersContext } = useContext(FiltersContext);
  const [year, setYear] = useState<number>(
    yearFromUrl ? Number(yearFromUrl) : new Date().getFullYear(),
  );
  const [referenceYears, setReferenceYears] = useState<number[]>([]);

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: taxReportQuery,
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
    <PageLayout
      title="Tax Report"
      headerActions={<PrintToPdfButton filename={`tax_report_${year}`} />}
    >
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <div className="flex flex-col gap-4">
          {report && (
            <Table className="text-base">
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead key={year}>{year}</TableHead>
                  <TableHead />
                  {referenceYearsData.map(report => (
                    <TableHead key={report.year}>{report.year}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <ReportCommentaryRow
                  dataRow={button => (
                    <TableRow>
                      <TableHead>Profit Before Tax</TableHead>
                      <TableHead>{report.profitBeforeTax.amount.formatted}</TableHead>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableHead key={report.year}>
                          {report.profitBeforeTax.amount.formatted}
                        </TableHead>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.profitBeforeTax}
                />
                <ReportCommentaryRow
                  dataRow={button => (
                    <TableRow>
                      <TableCell>R&D Expenses By Records</TableCell>
                      <TableCell>
                        {report.researchAndDevelopmentExpensesByRecords.amount.formatted}
                      </TableCell>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableCell key={report.year}>
                          {report.researchAndDevelopmentExpensesByRecords.amount.formatted}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.researchAndDevelopmentExpensesByRecords}
                />
                <TableRow>
                  <TableCell>R&D Expenses For Tax</TableCell>
                  <TableCell>{report.researchAndDevelopmentExpensesForTax.formatted}</TableCell>
                  <TableCell />
                  {referenceYearsData.map(report => (
                    <TableCell key={report.year}>
                      {report.researchAndDevelopmentExpensesForTax.formatted}
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
                <ReportCommentaryRow
                  dataRow={button => (
                    <TableRow>
                      <TableCell>Fines</TableCell>
                      <TableCell>{report.fines.amount.formatted}</TableCell>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableCell key={report.year}>{report.fines.amount.formatted}</TableCell>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.fines}
                />
                <ReportCommentaryRow
                  dataRow={button => (
                    <TableRow>
                      <TableCell>Untaxable Gifts</TableCell>
                      <TableCell>{report.untaxableGifts.amount.formatted}</TableCell>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableCell key={report.year}>
                          {report.untaxableGifts.amount.formatted}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.untaxableGifts}
                />
                <TableRow>
                  <TableCell>Business Trips Excess Expenses</TableCell>
                  <TableCell>{report.businessTripsExcessExpensesAmount.formatted}</TableCell>
                  <TableCell />
                  {referenceYearsData.map(report => (
                    <TableCell key={report.year}>
                      {report.businessTripsExcessExpensesAmount.formatted}
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell>Salary Excess Expenses</TableCell>
                  <TableCell>{report.salaryExcessExpensesAmount.formatted}</TableCell>
                  <TableCell />
                  {referenceYearsData.map(report => (
                    <TableCell key={report.year}>
                      {report.salaryExcessExpensesAmount.formatted}
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
                <ReportCommentaryRow
                  dataRow={button => (
                    <TableRow>
                      <TableCell>Reserves</TableCell>
                      <TableCell>{report.reserves.amount.formatted}</TableCell>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableCell key={report.year}>{report.reserves.amount.formatted}</TableCell>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.reserves}
                />
                <ReportCommentaryRow
                  dataRow={button => (
                    <TableRow>
                      <TableCell>Nontaxable Linkage</TableCell>
                      <TableCell>{report.nontaxableLinkage.amount.formatted}</TableCell>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableCell key={report.year}>
                          {report.nontaxableLinkage.amount.formatted}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.nontaxableLinkage}
                />
                <TableRow>
                  <TableHead>Taxable Income</TableHead>
                  <TableHead>{report.taxableIncome.formatted}</TableHead>
                  <TableHead />
                  {referenceYearsData.map(report => (
                    <TableHead key={report.year}>{report.taxableIncome.formatted}</TableHead>
                  ))}
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell>Tax Rate</TableCell>
                  <TableCell>{(report.taxRate * 100).toFixed(1)}%</TableCell>
                  <TableCell />
                  {referenceYearsData.map(report => (
                    <TableCell key={report.year}>{(report.taxRate * 100).toFixed(1)}%</TableCell>
                  ))}
                  <TableCell />
                </TableRow>

                <ReportCommentaryRow
                  dataRow={button => (
                    <TableRow>
                      <TableCell>Income with Special Tax Rate</TableCell>
                      <TableCell>{report.specialTaxableIncome.amount.formatted}</TableCell>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableCell key={report.year}>
                          {report.specialTaxableIncome.amount.formatted}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.specialTaxableIncome}
                />
                <TableRow>
                  <TableCell>Special Tax Rate</TableCell>
                  <TableCell>{(report.specialTaxRate * 100).toFixed(1)}%</TableCell>
                  <TableCell />
                  {referenceYearsData.map(report => (
                    <TableCell key={report.year}>
                      {(report.specialTaxRate * 100).toFixed(1)}%
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              </TableBody>
              <tfoot>
                <TableRow>
                  <TableHead>Annual Tax Expense</TableHead>
                  <TableHead>{report.annualTaxExpense.formatted}</TableHead>
                  <TableHead />
                  {referenceYearsData.map(report => (
                    <TableHead key={report.year}>{report.annualTaxExpense.formatted}</TableHead>
                  ))}
                  <TableCell />
                </TableRow>
              </tfoot>
            </Table>
          )}
        </div>
      )}
    </PageLayout>
  );
};
