import { useContext, useEffect, useState, type ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'urql';
import { PrintToPdfButton } from '@/components/common/index.js';
import { ProfitAndLossReportDocument } from '../../../gql/graphql.js';
import { dedupeFragments } from '../../../helpers/index.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PageLayout } from '../../layout/page-layout.js';
import { AccounterBarSpinner } from '../../ui/accounter-spinner.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { ReportCommentaryRow } from '../shared/report-commentary-row.js';
import { ProfitAndLossReportFilter } from './profit-and-loss-report-filters.js';

// Hoisted, matching `vat-monthly-report/index.tsx`: `dedupeFragments` builds a new
// `DocumentNode` on every call, so doing it inline re-printed and re-hashed the
// document on each render just to arrive at the same operation key.
const profitAndLossReportQuery = dedupeFragments(ProfitAndLossReportDocument);

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
          ...ReportCommentaryTableFields
        }
        costOfSales {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
        }
        grossProfit {
          formatted
        }
        researchAndDevelopmentExpenses {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
        }
        marketingExpenses {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
        }
        managementAndGeneralExpenses {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
        }
        operatingProfit {
          formatted
        }
        financialExpenses {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
        }
        otherIncome {
          amount {
            formatted
          }
          ...ReportCommentaryTableFields
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
  const { year: yearFromUrl } = useParams<{ year: string }>();
  const { setFiltersContext } = useContext(FiltersContext);
  const [year, setYear] = useState<number>(
    yearFromUrl ? Number(yearFromUrl) : new Date().getFullYear(),
  );
  const [referenceYears, setReferenceYears] = useState<number[]>([]);

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: profitAndLossReportQuery,
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
    <PageLayout
      title="Profit and Loss Report"
      headerActions={<PrintToPdfButton filename={`profit_and_loss_${year}`} />}
    >
      {fetching ? (
        <AccounterBarSpinner className="self-center" />
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
                      <TableHead>Revenue</TableHead>
                      <TableHead>{report.revenue.amount.formatted}</TableHead>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableHead key={report.year}>{report.revenue.amount.formatted}</TableHead>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.revenue}
                />
                <ReportCommentaryRow
                  dataRow={button => (
                    <TableRow>
                      <TableCell>Cost of Sales</TableCell>
                      <TableCell>{report.costOfSales.amount.formatted}</TableCell>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableCell key={report.year}>
                          {report.costOfSales.amount.formatted}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.costOfSales}
                />
                <TableRow>
                  <TableHead>Gross Profit</TableHead>
                  <TableHead>{report.grossProfit.formatted}</TableHead>
                  <TableHead />
                  {referenceYearsData.map(report => (
                    <TableHead key={report.year}>{report.grossProfit.formatted}</TableHead>
                  ))}
                </TableRow>
                <ReportCommentaryRow
                  dataRow={button => (
                    <TableRow>
                      <TableCell>R&D Expenses</TableCell>
                      <TableCell>
                        {report.researchAndDevelopmentExpenses.amount.formatted}
                      </TableCell>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableCell key={report.year}>
                          {report.researchAndDevelopmentExpenses.amount.formatted}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.researchAndDevelopmentExpenses}
                />
                <ReportCommentaryRow
                  dataRow={button => (
                    <TableRow>
                      <TableCell>Marketing Expenses</TableCell>
                      <TableCell>{report.marketingExpenses.amount.formatted}</TableCell>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableCell key={report.year}>
                          {report.marketingExpenses.amount.formatted}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.marketingExpenses}
                />
                <ReportCommentaryRow
                  dataRow={button => (
                    <TableRow>
                      <TableCell>Management and General Expenses</TableCell>
                      <TableCell>{report.managementAndGeneralExpenses.amount.formatted}</TableCell>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableCell key={report.year}>
                          {report.managementAndGeneralExpenses.amount.formatted}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.managementAndGeneralExpenses}
                />
                <TableRow>
                  <TableHead>Operating Profit</TableHead>
                  <TableHead>{report.operatingProfit.formatted}</TableHead>
                  <TableHead />
                  {referenceYearsData.map(report => (
                    <TableHead key={report.year}>{report.operatingProfit.formatted}</TableHead>
                  ))}
                </TableRow>
                <ReportCommentaryRow
                  dataRow={button => (
                    <TableRow>
                      <TableCell>Financial Expenses</TableCell>
                      <TableCell>{report.financialExpenses.amount.formatted}</TableCell>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableCell key={report.year}>
                          {report.financialExpenses.amount.formatted}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.financialExpenses}
                />
                <ReportCommentaryRow
                  dataRow={button => (
                    <TableRow>
                      <TableCell>Other Income</TableCell>
                      <TableCell>{report.otherIncome.amount.formatted}</TableCell>
                      <TableHead>{button}</TableHead>
                      {referenceYearsData.map(report => (
                        <TableCell key={report.year}>
                          {report.otherIncome.amount.formatted}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                  commentaryData={report.otherIncome}
                />
                <TableRow>
                  <TableHead>Profit Before Tax</TableHead>
                  <TableHead>{report.profitBeforeTax.formatted}</TableHead>
                  <TableHead />
                  {referenceYearsData.map(report => (
                    <TableHead key={report.year}>{report.profitBeforeTax.formatted}</TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Tax</TableCell>
                  <TableCell>{report.tax.formatted}</TableCell>
                  <TableCell />
                  {referenceYearsData.map(report => (
                    <TableCell key={report.year}>{report.tax.formatted}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
              <tfoot>
                <TableRow>
                  <TableHead>Net Profit</TableHead>
                  <TableHead>{report.netProfit.formatted}</TableHead>
                  <TableHead />
                  {referenceYearsData.map(report => (
                    <TableHead key={report.year}>{report.netProfit.formatted}</TableHead>
                  ))}
                </TableRow>
              </tfoot>
            </Table>
          )}
        </div>
      )}
    </PageLayout>
  );
};
