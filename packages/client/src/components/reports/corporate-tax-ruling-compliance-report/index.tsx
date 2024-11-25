import { ReactElement, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useMatch } from 'react-router-dom';
import { useQuery } from 'urql';
import { Indicator, Table, Tooltip } from '@mantine/core';
import { CorporateTaxRulingComplianceReportDocument } from '../../../gql/graphql.js';
import { dedupeFragments } from '../../../helpers/index.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PageLayout } from '../../layout/page-layout.jsx';
import { AmountCell } from './amount-cell.js';
import { CorporateTaxRulingComplianceReportFilter } from './corporate-tax-ruling-compliance-report-filters.js';
import { RuleCell } from './rule-cell.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query CorporateTaxRulingComplianceReport($years: [Int!]!) {
    corporateTaxRulingComplianceReport(years: $years) {
      id
      year
      totalIncome {
        ...CorporateTaxRulingReportAmountCellFields
      }
      researchAndDevelopmentExpenses {
        ...CorporateTaxRulingReportAmountCellFields
      }
      rndRelativeToIncome {
        rule
        ...CorporateTaxRulingReportRuleCellFields
      }
      localDevelopmentExpenses {
        ...CorporateTaxRulingReportAmountCellFields
      }
      localDevelopmentRelativeToRnd {
        rule
        ...CorporateTaxRulingReportRuleCellFields
      }
      foreignDevelopmentExpenses {
        ...CorporateTaxRulingReportAmountCellFields
      }
      foreignDevelopmentRelativeToRnd {
        rule
        ...CorporateTaxRulingReportRuleCellFields
      }
      businessTripRndExpenses {
        ...CorporateTaxRulingReportAmountCellFields
      }
      ... on CorporateTaxRulingComplianceReport @defer {
        differences {
          id
          totalIncome {
            ...CorporateTaxRulingReportAmountCellFields
          }
          researchAndDevelopmentExpenses {
            ...CorporateTaxRulingReportAmountCellFields
          }
          rndRelativeToIncome {
            ...CorporateTaxRulingReportRuleCellFields
          }
          localDevelopmentExpenses {
            ...CorporateTaxRulingReportAmountCellFields
          }
          localDevelopmentRelativeToRnd {
            ...CorporateTaxRulingReportRuleCellFields
          }
          foreignDevelopmentExpenses {
            ...CorporateTaxRulingReportAmountCellFields
          }
          foreignDevelopmentRelativeToRnd {
            ...CorporateTaxRulingReportRuleCellFields
          }
          businessTripRndExpenses {
            ...CorporateTaxRulingReportAmountCellFields
          }
        }
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
                    <th key={year}>
                      <Indicator
                        inline
                        size={12}
                        processing={
                          !yearlyReports.find(report => report.year === year)?.differences
                        }
                        disabled={!!yearlyReports.find(report => report.year === year)?.differences}
                        color="orange"
                        zIndex="auto"
                      >
                        {year}
                      </Indicator>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total Income</td>
                  {yearlyReports.map(report => (
                    <AmountCell
                      key={report.year}
                      originalAmountData={report.totalIncome}
                      diffAmountData={report.differences?.totalIncome ?? undefined}
                    />
                  ))}
                </tr>
                <tr>
                  <td>Total R&D Expensess</td>
                  {yearlyReports.map(report => (
                    <AmountCell
                      key={report.year}
                      originalAmountData={report.researchAndDevelopmentExpenses}
                      diffAmountData={
                        report.differences?.researchAndDevelopmentExpenses ?? undefined
                      }
                    />
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
                    <RuleCell
                      key={report.year}
                      originalRuleData={report.rndRelativeToIncome}
                      diffRuleData={report.differences?.rndRelativeToIncome ?? undefined}
                    />
                  ))}
                </tr>
                <tr>
                  <td>Local Development Expenses</td>
                  {yearlyReports.map(report => (
                    <AmountCell
                      key={report.year}
                      originalAmountData={report.localDevelopmentExpenses}
                      diffAmountData={report.differences?.localDevelopmentExpenses ?? undefined}
                    />
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
                    <RuleCell
                      key={report.year}
                      originalRuleData={report.localDevelopmentRelativeToRnd}
                      diffRuleData={report.differences?.localDevelopmentRelativeToRnd ?? undefined}
                    />
                  ))}
                </tr>
                <tr>
                  <td>Foreign Development Expenses</td>
                  {yearlyReports.map(report => (
                    <AmountCell
                      key={report.year}
                      originalAmountData={report.foreignDevelopmentExpenses}
                      diffAmountData={report.differences?.foreignDevelopmentExpenses ?? undefined}
                    />
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
                    <RuleCell
                      key={report.year}
                      originalRuleData={report.foreignDevelopmentRelativeToRnd}
                      diffRuleData={
                        report.differences?.foreignDevelopmentRelativeToRnd ?? undefined
                      }
                    />
                  ))}
                </tr>
                <tr>
                  <td>R&D Business Trips Expenses</td>
                  {yearlyReports.map(report => (
                    <AmountCell
                      key={report.year}
                      originalAmountData={report.businessTripRndExpenses}
                      diffAmountData={report.differences?.businessTripRndExpenses ?? undefined}
                    />
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
