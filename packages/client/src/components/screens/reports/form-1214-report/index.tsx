import { useCallback, useEffect, useMemo, type ReactElement } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from 'urql';
import {
  Form1214ReportScreenDocument,
  Form1214SupportedYearsDocument,
} from '../../../../gql/graphql.js';
import { AccounterSpinner } from '../../../ui/accounter-spinner.js';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/alert.js';
import { Card, CardHeader, CardTitle } from '../../../ui/card.js';
import { Label } from '../../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import { Form1214DownloadButton } from './download-button.js';
import { Form1214ReportSections } from './report-sections.js';
import { Form1214ValidationPanel } from './validation-panel.js';
import { resolveForm1214Year, sortForm1214Years } from './years.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query Form1214SupportedYears {
    report1214SupportedYears
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query Form1214ReportScreen($year: Int!) {
    report1214(year: $year) {
      id
      year
      owner {
        id
        name
      }
      validation {
        isValid
        ...Form1214ValidationPanel
      }
      ...Form1214ReportSections
    }
  }
`;

/**
 * The annual company report (form 1214) of the active business: its validation, the data it is
 * built from and the file to upload to SHAAM. The year lives in the URL (`?year=`), so the annual
 * audit can link straight to the year it closes, and to a section (`#shareholders`).
 */
export function Form1214Report(): ReactElement {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [{ data: yearsData, fetching: yearsFetching, error: yearsError }] = useQuery({
    query: Form1214SupportedYearsDocument,
  });
  const supportedYears = useMemo(
    () => sortForm1214Years(yearsData?.report1214SupportedYears ?? []),
    [yearsData],
  );
  const yearParam = searchParams.get('year');
  const selectedYear = resolveForm1214Year(yearParam, supportedYears);

  // Keeps `?year=` and the hash (a section anchor) together: `setSearchParams` would drop the hash
  const setYearInUrl = useCallback(
    (year: number) => {
      const next = new URLSearchParams(location.search);
      next.set('year', String(year));
      navigate({ search: `?${next.toString()}`, hash: location.hash }, { replace: true });
    },
    [location.search, location.hash, navigate],
  );

  // A missing or unsupported `?year=` falls back to the latest supported year: show it in the URL
  useEffect(() => {
    if (selectedYear !== undefined && yearParam !== String(selectedYear)) {
      setYearInUrl(selectedYear);
    }
  }, [selectedYear, yearParam, setYearInUrl]);

  // The report omits `ownerId`: the server reports on the active business, the only one whose 1214
  // data can be edited
  const [{ data, fetching, error }] = useQuery({
    query: Form1214ReportScreenDocument,
    variables: { year: selectedYear ?? 0 },
    pause: selectedYear === undefined,
  });
  const report = data?.report1214.year === selectedYear ? data?.report1214 : undefined;

  // The sections render only once the report loads, after the browser looked for the hash's
  // element: scroll to it then
  const hasReport = !!report;
  useEffect(() => {
    if (hasReport && location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }
  }, [hasReport, location.hash]);

  return (
    <div className="container mx-auto space-y-4 p-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">Form 1214: annual company report</CardTitle>
            {report && <p className="text-sm text-muted-foreground">{report.owner.name}</p>}
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="form-1214-year">Tax year</Label>
            <Select
              value={selectedYear === undefined ? undefined : String(selectedYear)}
              onValueChange={value => setYearInUrl(Number.parseInt(value, 10))}
              disabled={supportedYears.length === 0}
            >
              <SelectTrigger id="form-1214-year" className="w-28">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {supportedYears.map(year => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedYear !== undefined && (
              <Form1214DownloadButton year={selectedYear} disabled={!report?.validation.isValid} />
            )}
          </div>
        </CardHeader>
      </Card>

      {yearsError || error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load the 1214 report</AlertTitle>
          <AlertDescription>{(yearsError ?? error)?.message}</AlertDescription>
        </Alert>
      ) : !yearsFetching && supportedYears.length === 0 ? (
        <Alert>
          <AlertTitle>No supported tax years</AlertTitle>
          <AlertDescription>Form 1214 cannot be generated for any tax year yet.</AlertDescription>
        </Alert>
      ) : yearsFetching || fetching || !report ? (
        <div className="flex justify-center p-8">
          <AccounterSpinner className="size-24" />
        </div>
      ) : (
        <>
          <Form1214ValidationPanel validation={report.validation} />
          <Form1214ReportSections report={report} />
        </>
      )}
    </div>
  );
}
