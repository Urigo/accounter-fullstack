import { useContext, useEffect, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'urql';
import { CorporateTaxRulingComplianceReportDocument, Currency } from '../../../gql/graphql.js';
import { dedupeFragments, getCurrencyFormatter } from '../../../helpers/index.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PrintToPdfButton, Tooltip } from '../../common/index.js';
import { PageLayout } from '../../layout/page-layout.js';
import { Indicator } from '../../ui/indicator.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { AmountCell } from './amount-cell.js';
import { CorporateTaxRulingComplianceReportFilter } from './corporate-tax-ruling-compliance-report-filters.js';
import { RuleCell } from './rule-cell.js';

// Hoisted, matching `vat-monthly-report/index.tsx`: `dedupeFragments` builds a new
// `DocumentNode` on every call, so doing it inline re-printed and re-hashed the
// document on each render just to arrive at the same operation key.
const corporateTaxRulingComplianceReportQuery = dedupeFragments(
  CorporateTaxRulingComplianceReportDocument,
);

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
    query: corporateTaxRulingComplianceReportQuery,
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
    <PageLayout
      title="Corporate Tax Ruling Compliance Report"
      headerActions={
        <PrintToPdfButton filename={`corporate_tax_ruling_compliance_${years[0] ?? ''}`} />
      }
    >
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <div className="flex flex-col gap-4">
          {yearlyReports && (
            <Table className="text-base">
              <TableHeader>
                <TableRow>
                  <TableHead />
                  {years.map(year => (
                    <TableHead key={year}>
                      <Tooltip
                        content="Checking for ledger suggested changes"
                        asChild
                        disabled={!!yearlyReports.find(report => report.year === year)?.differences}
                      >
                        <Indicator
                          inline
                          size={12}
                          processing={
                            !yearlyReports.find(report => report.year === year)?.differences
                          }
                          disabled={
                            !!yearlyReports.find(report => report.year === year)?.differences
                          }
                          color="orange"
                        >
                          {year}
                        </Indicator>
                      </Tooltip>
                    </TableHead>
                  ))}
                  <TableHead key="sum">Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Total Income</TableCell>
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
                </TableRow>
                <TableRow>
                  <TableCell>Total R&D Expensess</TableCell>
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
                </TableRow>
                <TableRow>
                  <TableHead>
                    <Tooltip
                      content={yearlyReports[0]?.rndRelativeToIncome.rule}
                      className="max-w-[220px] whitespace-normal"
                    >
                      <p>R&D Expenses out of Income</p>
                    </Tooltip>
                  </TableHead>
                  {yearlyReports.map(report => (
                    <RuleCell
                      key={report.year}
                      originalRuleData={report.rndRelativeToIncome}
                      diffRuleData={report.differences?.rndRelativeToIncome ?? undefined}
                    />
                  ))}
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell>Local Development Expenses</TableCell>
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
                </TableRow>
                <TableRow>
                  <TableHead>
                    <Tooltip
                      content={yearlyReports[0]?.localDevelopmentRelativeToRnd.rule}
                      className="max-w-[220px] whitespace-normal"
                    >
                      <p>Local Development out of R&D</p>
                    </Tooltip>
                  </TableHead>
                  {yearlyReports.map(report => (
                    <RuleCell
                      key={report.year}
                      originalRuleData={report.localDevelopmentRelativeToRnd}
                      diffRuleData={report.differences?.localDevelopmentRelativeToRnd ?? undefined}
                    />
                  ))}
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell>Foreign Development Expenses</TableCell>
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
                </TableRow>
                <TableRow>
                  <TableHead>
                    <Tooltip
                      content={yearlyReports[0]?.foreignDevelopmentRelativeToRnd.rule}
                      className="max-w-[220px] whitespace-normal"
                    >
                      <p>Foreign Development out of R&D</p>
                    </Tooltip>
                  </TableHead>
                  {yearlyReports.map(report => (
                    <RuleCell
                      key={report.year}
                      originalRuleData={report.foreignDevelopmentRelativeToRnd}
                      diffRuleData={
                        report.differences?.foreignDevelopmentRelativeToRnd ?? undefined
                      }
                    />
                  ))}
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell>R&D Business Trips Expenses</TableCell>
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
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </PageLayout>
  );
};
