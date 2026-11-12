import { useCallback, useContext, useMemo, type ReactElement } from 'react';
import { Printer } from 'lucide-react';
import { useQuery } from 'urql';
import { SecuritiesSemiAnnualReportScreenDocument } from '../../../../gql/graphql.js';
import { useGetAdminBusinesses } from '../../../../hooks/use-get-admin-businesses.js';
import { usePrintDocumentTitle } from '../../../../hooks/use-print-document-title.js';
import { useUrlFilterState } from '../../../../hooks/use-url-filter-state.js';
import { UserContext } from '../../../../providers/user-provider.js';
import { normalizeFilter } from '../../../../router/routes.js';
import { PageLayout } from '../../../layout/page-layout.js';
import { AccounterBarSpinner } from '../../../ui/accounter-spinner.js';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/alert.js';
import { Button } from '../../../ui/button.js';
import { DeclarationDocument } from './declaration-document.js';
import {
  defaultSemiAnnualFilter,
  SECURITIES_SEMI_ANNUAL_PARAM,
  semiAnnualFileName,
  semiAnnualFilterSchema,
  type SemiAnnualFilter,
} from './helpers.js';
import { IncomeAppendix } from './income-appendix.js';
import { ReportControls } from './report-controls.js';
import { ReportIssues } from './report-issues.js';
import { SalesAppendix } from './sales-appendix.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query SecuritiesSemiAnnualReportScreen(
    $year: Int!
    $half: YearHalf!
    $priorYearsLosses: Float
    $businessId: UUID
  ) {
    securitiesSemiAnnualReport(
      year: $year
      half: $half
      priorYearsLosses: $priorYearsLosses
      businessId: $businessId
    ) {
      id
      year
      half
      issues {
        id
      }
      ...SecuritiesSemiAnnualDeclaration
      ...SecuritiesSemiAnnualSales
      ...SecuritiesSemiAnnualIncome
      ...SecuritiesSemiAnnualIssues
    }
  }
`;

const todayString = () => {
  const today = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
};

/**
 * The semi-annual securities report the company files with the Tax Authority (s.91(d)): the
 * accountant's letter and how each of its figures was worked out, printable as an A4 PDF.
 */
export function SecuritiesSemiAnnualReport(): ReactElement {
  const [storedFilter, setFilter] = useUrlFilterState<SemiAnnualFilter>(
    SECURITIES_SEMI_ANNUAL_PARAM,
    semiAnnualFilterSchema,
  );
  const filter = useMemo<SemiAnnualFilter>(
    () => ({ ...defaultSemiAnnualFilter(), ...storedFilter }),
    [storedFilter],
  );
  const onFilterChange = useCallback(
    (next: SemiAnnualFilter) => setFilter(normalizeFilter(next)),
    [setFilter],
  );

  const { userContext } = useContext(UserContext);
  const { adminBusinesses, soleAdminBusinessId } = useGetAdminBusinesses();
  const businessId =
    filter.businessId ?? soleAdminBusinessId ?? userContext?.context.adminBusinessId ?? undefined;

  const [{ data, fetching, error }, refetch] = useQuery({
    query: SecuritiesSemiAnnualReportScreenDocument,
    variables: {
      year: filter.year,
      half: filter.half,
      priorYearsLosses: filter.priorYearsLosses ?? null,
      businessId: businessId || null,
    },
  });
  const report = data?.securitiesSemiAnnualReport;

  // named after the report shown, which lags the filter while a new period loads
  usePrintDocumentTitle(
    semiAnnualFileName(report?.year ?? filter.year, report?.half ?? filter.half),
  );

  return (
    <PageLayout
      title="Securities Semi-Annual Report"
      description="Half-yearly report on securities sales, dividends and interest, and the tax advance due (Income Tax Ordinance s.91(d))"
      hideHeaderInPrint
      headerActions={
        <Button
          onClick={() => window.print()}
          disabled={!report || fetching}
          className="print:hidden"
        >
          <Printer className="size-4" />
          Print / Save PDF
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pb-10 print:gap-0 print:pb-0">
        <ReportControls
          filter={filter}
          onChange={onFilterChange}
          businesses={adminBusinesses}
          defaultBusinessId={businessId}
        />

        {fetching && !report && <AccounterBarSpinner className="mx-auto h-12 w-40" />}

        {error && (
          <Alert variant="destructive" className="print:hidden">
            <AlertTitle>Could not load the report</AlertTitle>
            <AlertDescription>{error.graphQLErrors[0]?.message ?? error.message}</AlertDescription>
          </Alert>
        )}

        {report && (
          <>
            <ReportIssues
              data={report}
              canSetTaxCategories={businessId === userContext?.context.adminBusinessId}
              onTaxCategorySet={() => refetch({ requestPolicy: 'network-only' })}
            />
            <div className={fetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <div className="flex flex-col gap-6 print:block">
                <DeclarationDocument
                  data={report}
                  preparedOn={todayString()}
                  issueCount={report.issues.length}
                />
                <SalesAppendix data={report} />
                <IncomeAppendix data={report} />
              </div>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
