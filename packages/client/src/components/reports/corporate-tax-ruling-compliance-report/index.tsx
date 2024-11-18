import { ReactElement, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useMatch } from 'react-router-dom';
import { useQuery } from 'urql';
import { Table, Tooltip } from '@mantine/core';
import { CorporateTaxRulingComplianceReportDocument } from '../../../gql/graphql.js';
import { dedupeFragments } from '../../../helpers/index.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PageLayout } from '../../layout/page-layout.jsx';
import { CorporateTaxRulingComplianceReportFilter } from './corporate-tax-ruling-compliance-report-filters.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query CorporateTaxRulingComplianceReport($years: [Int!]!) {
    corporateTaxRulingComplianceReport(years: $years) {
      id
      year
      totalIncome {
        formatted
      }
      researchAndDevelopmentExpenses {
        formatted
      }
      rndRelativeToIncome {
        id
        rule
        percentage {
          formatted
        }
        isCompliant
      }
      localDevelopmentExpenses {
        formatted
      }
      localDevelopmentRelativeToRnd {
        id
        rule
        percentage {
          formatted
        }
        isCompliant
      }
      foreignDevelopmentExpenses {
        formatted
      }
      foreignDevelopmentRelativeToRnd {
        id
        rule
        percentage {
          formatted
        }
        isCompliant
      }
      businessTripRndExpenses {
        formatted
      }
    }
  }
`;

export const CorporateTaxRulingComplianceReport = (): ReactElement => {
  const match = useMatch('/reports/corporate-tax-ruling-compliance/:year');
  const { setFiltersContext } = useContext(FiltersContext);
  const [years, setYears] = useState<number[]>(
    (match ? [Number(match.params.year)] : undefined) ?? [new Date().getFullYear()],
  );

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: dedupeFragments(CorporateTaxRulingComplianceReportDocument),
    variables: {
      years,
    },
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-2">
        <CorporateTaxRulingComplianceReportFilter years={years} setYears={setYears} />
      </div>,
    );
  }, [years, fetching, setFiltersContext]);

  const yearlyReports = data?.corporateTaxRulingComplianceReport ?? [];

  return (
    <PageLayout title="Corporate Tax Ruling Compliance Report">
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
                  <td>Total Income</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{report.totalIncome.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <td>Total R&D Expensess</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{report.researchAndDevelopmentExpenses.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <th>
                    <Tooltip
                      multiline
                      width={220}
                      transitionProps={{ duration: 200 }}
                      label={yearlyReports[0]?.rndRelativeToIncome.rule}
                    >
                      <p>R&D Expenses out of Income</p>
                    </Tooltip>
                  </th>
                  {yearlyReports.map(report => (
                    <td
                      key={report.year}
                      className={
                        report.rndRelativeToIncome.isCompliant ? 'text-green-500' : 'text-red-500'
                      }
                    >
                      {report.rndRelativeToIncome.percentage.formatted}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Local Development Expenses</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{report.localDevelopmentExpenses.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <th>
                    <Tooltip
                      multiline
                      width={220}
                      transitionProps={{ duration: 200 }}
                      label={yearlyReports[0]?.localDevelopmentRelativeToRnd.rule}
                    >
                      <p>Local Development out of R&D</p>
                    </Tooltip>
                  </th>
                  {yearlyReports.map(report => (
                    <td
                      key={report.year}
                      className={
                        report.localDevelopmentRelativeToRnd.isCompliant
                          ? 'text-green-500'
                          : 'text-red-500'
                      }
                    >
                      {report.localDevelopmentRelativeToRnd.percentage.formatted}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Foreign Development Expenses</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{report.foreignDevelopmentExpenses.formatted}</td>
                  ))}
                </tr>
                <tr>
                  <th>
                    <Tooltip
                      multiline
                      width={220}
                      transitionProps={{ duration: 200 }}
                      label={yearlyReports[0]?.foreignDevelopmentRelativeToRnd.rule}
                    >
                      <p>Foreign Development out of R&D</p>
                    </Tooltip>
                  </th>
                  {yearlyReports.map(report => (
                    <td
                      key={report.year}
                      className={
                        report.foreignDevelopmentRelativeToRnd.isCompliant
                          ? 'text-green-500'
                          : 'text-red-500'
                      }
                    >
                      {report.foreignDevelopmentRelativeToRnd.percentage.formatted}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>R&D Business Trips Expenses</td>
                  {yearlyReports.map(report => (
                    <td key={report.year}>{report.businessTripRndExpenses.formatted}</td>
                  ))}
                </tr>
              </tbody>
            </Table>
          )}
        </div>
      )}
    </PageLayout>
  );
};
