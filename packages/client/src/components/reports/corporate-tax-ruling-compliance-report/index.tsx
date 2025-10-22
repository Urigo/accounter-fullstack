import { useContext, useEffect, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'urql';
import { Indicator, Table, Tooltip } from '@mantine/core';
import { CorporateTaxRulingComplianceReportDocument, Currency } from '../../../gql/graphql.js';
import { dedupeFragments, getCurrencyFormatter } from '../../../helpers/index.js';
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
        formatted
        raw
        currency
      }
      researchAndDevelopmentExpenses {
        formatted
        raw
        currency
      }
      rndRelativeToIncome {
        rule
        ...CorporateTaxRulingReportRuleCellFields
      }
      localDevelopmentExpenses {
        formatted
        raw
        currency
      }
      localDevelopmentRelativeToRnd {
        rule
        ...CorporateTaxRulingReportRuleCellFields
      }
      foreignDevelopmentExpenses {
        formatted
        raw
        currency
      }
      foreignDevelopmentRelativeToRnd {
        rule
        ...CorporateTaxRulingReportRuleCellFields
      }
      businessTripRndExpenses {
        formatted
        raw
        currency
      }
      ... on CorporateTaxRulingComplianceReport @defer {
        differences {
          id
          totalIncome {
            formatted
            raw
            currency
          }
          researchAndDevelopmentExpenses {
            formatted
            raw
            currency
          }
          rndRelativeToIncome {
            ...CorporateTaxRulingReportRuleCellFields
          }
          localDevelopmentExpenses {
            formatted
            raw
            currency
          }
          localDevelopmentRelativeToRnd {
            ...CorporateTaxRulingReportRuleCellFields
          }
          foreignDevelopmentExpenses {
            formatted
            raw
            currency
          }
          foreignDevelopmentRelativeToRnd {
            ...CorporateTaxRulingReportRuleCellFields
          }
          businessTripRndExpenses {
            formatted
            raw
            currency
          }
        }
      }
    }
  }
`;

const formatter = (amount: number, currency: Currency) =>
  getCurrencyFormatter(currency).format(amount);

function multipleOptionalFormatter(amounts: number[], currency: Currency) {
  if (amounts.length === 0) return undefined;
  return formatter(
    amounts.reduce((acc, curr) => acc + curr, 0),
    currency,
  );
}

export const CorporateTaxRulingComplianceReport = (): ReactElement => {
  const { year: yearFromUrl } = useParams<{ year: string }>();
  const { setFiltersContext } = useContext(FiltersContext);
  const [years, setYears] = useState<number[]>(
    yearFromUrl ? [Number(yearFromUrl)] : [new Date().getFullYear()],
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
                  <th key="sum">Summary</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total Income</td>
                  {yearlyReports.map(report => (
                    <AmountCell
                      key={report.year}
                      originalAmount={report.totalIncome.formatted}
                      diffAmount={report.differences?.totalIncome?.formatted ?? undefined}
                    />
                  ))}
                  <AmountCell
                    key="sum"
                    originalAmount={formatter(
                      yearlyReports
                        .map(report => report.totalIncome.raw)
                        .reduce((acc, curr) => acc + curr, 0),
                      yearlyReports[0].totalIncome.currency,
                    )}
                    diffAmount={multipleOptionalFormatter(
                      yearlyReports
                        .map(
                          report => report.differences?.totalIncome?.raw ?? report.totalIncome.raw,
                        )
                        .filter(value => !!value) as number[],
                      yearlyReports[0].totalIncome.currency,
                    )}
                  />
                </tr>
                <tr>
                  <td>Total R&D Expensess</td>
                  {yearlyReports.map(report => (
                    <AmountCell
                      key={report.year}
                      originalAmount={report.researchAndDevelopmentExpenses.formatted}
                      diffAmount={
                        report.differences?.researchAndDevelopmentExpenses?.formatted ?? undefined
                      }
                    />
                  ))}
                  <AmountCell
                    key="sum"
                    originalAmount={formatter(
                      yearlyReports
                        .map(report => report.researchAndDevelopmentExpenses.raw)
                        .reduce((acc, curr) => acc + curr, 0),
                      yearlyReports[0].researchAndDevelopmentExpenses.currency,
                    )}
                    diffAmount={multipleOptionalFormatter(
                      yearlyReports
                        .map(
                          report =>
                            report.differences?.researchAndDevelopmentExpenses?.raw ??
                            report.researchAndDevelopmentExpenses.raw,
                        )
                        .filter(value => !!value) as number[],
                      yearlyReports[0].researchAndDevelopmentExpenses.currency,
                    )}
                  />
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
                  <td />
                </tr>
                <tr>
                  <td>Local Development Expenses</td>
                  {yearlyReports.map(report => (
                    <AmountCell
                      key={report.year}
                      originalAmount={report.localDevelopmentExpenses.formatted}
                      diffAmount={
                        report.differences?.localDevelopmentExpenses?.formatted ?? undefined
                      }
                    />
                  ))}
                  <AmountCell
                    key="sum"
                    originalAmount={formatter(
                      yearlyReports
                        .map(report => report.localDevelopmentExpenses.raw)
                        .reduce((acc, curr) => acc + curr, 0),
                      yearlyReports[0].localDevelopmentExpenses.currency,
                    )}
                    diffAmount={multipleOptionalFormatter(
                      yearlyReports
                        .map(
                          report =>
                            report.differences?.localDevelopmentExpenses?.raw ??
                            report.localDevelopmentExpenses.raw,
                        )
                        .filter(value => !!value) as number[],
                      yearlyReports[0].localDevelopmentExpenses.currency,
                    )}
                  />
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
                  <td />
                </tr>
                <tr>
                  <td>Foreign Development Expenses</td>
                  {yearlyReports.map(report => (
                    <AmountCell
                      key={report.year}
                      originalAmount={report.foreignDevelopmentExpenses.formatted}
                      diffAmount={
                        report.differences?.foreignDevelopmentExpenses?.formatted ?? undefined
                      }
                    />
                  ))}
                  <AmountCell
                    key="sum"
                    originalAmount={formatter(
                      yearlyReports
                        .map(report => report.foreignDevelopmentExpenses.raw)
                        .reduce((acc, curr) => acc + curr, 0),
                      yearlyReports[0].foreignDevelopmentExpenses.currency,
                    )}
                    diffAmount={multipleOptionalFormatter(
                      yearlyReports
                        .map(
                          report =>
                            report.differences?.foreignDevelopmentExpenses?.raw ??
                            report.foreignDevelopmentExpenses.raw,
                        )
                        .filter(value => !!value) as number[],
                      yearlyReports[0].foreignDevelopmentExpenses.currency,
                    )}
                  />
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
                  <td />
                </tr>
                <tr>
                  <td>R&D Business Trips Expenses</td>
                  {yearlyReports.map(report => (
                    <AmountCell
                      key={report.year}
                      originalAmount={report.businessTripRndExpenses.formatted}
                      diffAmount={
                        report.differences?.businessTripRndExpenses?.formatted ?? undefined
                      }
                    />
                  ))}
                  <AmountCell
                    key="sum"
                    originalAmount={formatter(
                      yearlyReports
                        .map(report => report.businessTripRndExpenses.raw)
                        .reduce((acc, curr) => acc + curr, 0),
                      yearlyReports[0].businessTripRndExpenses.currency,
                    )}
                    diffAmount={multipleOptionalFormatter(
                      yearlyReports
                        .map(
                          report =>
                            report.differences?.businessTripRndExpenses?.raw ??
                            report.businessTripRndExpenses.raw,
                        )
                        .filter(value => !!value) as number[],
                      yearlyReports[0].businessTripRndExpenses.currency,
                    )}
                  />
                </tr>
              </tbody>
            </Table>
          )}
        </div>
      )}
    </PageLayout>
  );
};
