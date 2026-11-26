import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useBlocker, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, type CombinedError } from 'urql';
import {
  Form1214ReportScreenDocument,
  Form1214SupportedYearsDocument,
} from '../../../../gql/graphql.js';
import { SUPPRESS_ERROR_TOAST_CONTEXT } from '../../../../providers/urql-error-handler.js';
import { AccounterSpinner } from '../../../ui/accounter-spinner.js';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/alert.js';
import { Card, CardHeader } from '../../../ui/card.js';
import { Label } from '../../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import { Spinner } from '../../../ui/spinner.js';
import { Form1214DownloadButton } from './download-button.js';
import { Form1214ReportProvider, useForm1214DirtySections } from './report-context.js';
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

// The page shows its own errors inline: skip the client-wide error toast, so one failure is not
// reported twice. Module-level, so the queries' context keeps its identity across renders.
const QUERY_CONTEXT = SUPPRESS_ERROR_TOAST_CONTEXT;

/** The error's message, without urql's "[GraphQL] " / "[Network] " prefix. */
function errorMessage(error: CombinedError): string {
  return error.graphQLErrors[0]?.message ?? error.networkError?.message ?? error.message;
}

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
    context: QUERY_CONTEXT,
  });
  const supportedYears = useMemo(
    () => sortForm1214Years(yearsData?.report1214SupportedYears ?? []),
    [yearsData],
  );
  const yearParam = searchParams.get('year');
  const selectedYear = resolveForm1214Year(yearParam, supportedYears);

  // A year the URL asked for but form 1214 does not support (the annual audit links here with the
  // audited year), and the year shown instead. Kept apart from the URL, which the fallback rewrites.
  const [unsupportedYear, setUnsupportedYear] = useState<
    { requested: number; shown: number } | undefined
  >();

  // A missing or unsupported `?year=` falls back to the latest supported year: show it in the URL.
  // The hash (a section anchor) is kept; `setSearchParams` would drop it.
  useEffect(() => {
    if (selectedYear !== undefined && yearParam !== String(selectedYear)) {
      // A missing year (the side-menu link) falls back silently; an explicit one is reported
      if (yearParam && /^\d{4}$/.test(yearParam)) {
        setUnsupportedYear({ requested: Number.parseInt(yearParam, 10), shown: selectedYear });
      }
      const next = new URLSearchParams(location.search);
      next.set('year', String(selectedYear));
      navigate({ search: `?${next.toString()}`, hash: location.hash }, { replace: true });
    }
  }, [selectedYear, yearParam, location.search, location.hash, navigate]);

  const { setDirty, hasDirtySections } = useForm1214DirtySections();

  // Leaving the page loses unsaved edits too. In-app navigation away (a link, back, forward) asks
  // first; a `?year=` change on this page is the year select's own question below
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname && hasDirtySections(),
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') {
      return;
    }
    if (window.confirm('You have unsaved changes in the 1214 report. Discard them and leave?')) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);
  // A reload or closing the tab gets the browser's own prompt
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasDirtySections()) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasDirtySections]);

  // A year picked by hand starts at the top of the page: the section anchor is dropped. Switching
  // unmounts the sections, so unsaved edits would be lost: ask first
  const selectYear = useCallback(
    (year: string) => {
      if (
        hasDirtySections() &&
        !window.confirm(
          'You have unsaved changes in the 1214 report. Discard them and switch year?',
        )
      ) {
        return;
      }
      setUnsupportedYear(undefined);
      const next = new URLSearchParams(location.search);
      next.set('year', year);
      navigate({ search: `?${next.toString()}` }, { replace: true });
    },
    [location.search, navigate, hasDirtySections],
  );

  // The report omits `ownerId`: the server reports on the active business, the only one whose 1214
  // data can be edited
  const [{ data, fetching, error }, reexecute] = useQuery({
    query: Form1214ReportScreenDocument,
    variables: { year: selectedYear ?? 0 },
    pause: selectedYear === undefined,
    context: QUERY_CONTEXT,
  });
  const refresh = useCallback(() => reexecute({ requestPolicy: 'network-only' }), [reexecute]);
  // urql keeps the previous result while another year loads: never show one year as another
  const report = data?.report1214.year === selectedYear ? data?.report1214 : undefined;

  // The sections render only once the report loads, after the browser looked for the hash's
  // element: scroll to it then, once per hash, so a refresh does not scroll the page back
  const hasReport = !!report;
  const scrolledHash = useRef<string | null>(null);
  useEffect(() => {
    if (hasReport && location.hash && scrolledHash.current !== location.hash) {
      const element = document.getElementById(location.hash.slice(1));
      if (element) {
        scrolledHash.current = location.hash;
        element.scrollIntoView();
      }
    }
  }, [hasReport, location.hash]);

  const loadError = yearsError ?? error;
  let disabledReason: string | undefined;
  if (!report) {
    disabledReason = loadError ? 'Could not load the report' : 'Loading';
  } else if (!report.validation.isValid) {
    disabledReason = 'Resolve the blocking issues';
  }

  return (
    <div className="container mx-auto space-y-4 p-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Form 1214: annual company report</h1>
            {report && <p className="text-sm text-muted-foreground">{report.owner.name}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {report && fetching && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Spinner />
                Refreshing…
              </span>
            )}
            <Label htmlFor="form-1214-year">Tax year</Label>
            <Select
              value={selectedYear ? String(selectedYear) : ''}
              onValueChange={selectYear}
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
              <Form1214DownloadButton year={selectedYear} disabledReason={disabledReason} />
            )}
          </div>
        </CardHeader>
      </Card>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load the 1214 report</AlertTitle>
          <AlertDescription>{errorMessage(loadError)}</AlertDescription>
        </Alert>
      )}
      {unsupportedYear && unsupportedYear.shown === selectedYear && (
        <Alert>
          <AlertTitle>Form 1214 is not available for {unsupportedYear.requested}</AlertTitle>
          <AlertDescription>Showing {unsupportedYear.shown} instead.</AlertDescription>
        </Alert>
      )}
      {!loadError && !yearsFetching && supportedYears.length === 0 && (
        <Alert>
          <AlertTitle>No supported tax years</AlertTitle>
          <AlertDescription>Form 1214 cannot be generated for any tax year yet.</AlertDescription>
        </Alert>
      )}
      {report ? (
        <Form1214ReportProvider year={report.year} refresh={refresh} setDirty={setDirty}>
          <Form1214ValidationPanel validation={report.validation} />
          <Form1214ReportSections report={report} />
        </Form1214ReportProvider>
      ) : (
        !loadError &&
        (yearsFetching || selectedYear !== undefined) && (
          <div className="flex justify-center p-8">
            <AccounterSpinner className="size-24" />
          </div>
        )
      )}
    </div>
  );
}
