import { useMemo, type ReactElement } from 'react';
import { useQuery } from 'urql';
import { z } from 'zod';
import { IrsCodesReportScreenDocument } from '../../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX, type TimelessDateString } from '../../../../helpers/index.js';
import { useUrlFilterState } from '../../../../hooks/use-url-filter-state.js';
import { normalizeFilter } from '../../../../router/routes.js';
import { DatePickerInput } from '../../../common/inputs/date-picker-input.js';
import { PageLayout } from '../../../layout/page-layout.js';
import { ReportSubCommentaryRow } from '../../../reports/shared/report-sub-commentary-row.js';
import { AccounterBarSpinner } from '../../../ui/accounter-spinner.js';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/alert.js';
import { Label } from '../../../ui/label.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query IrsCodesReportScreen($fromDate: TimelessDate!, $toDate: TimelessDate!) {
    irsCodesReport(fromDate: $fromDate, toDate: $toDate) {
      id
      irsCode
      label
      amount {
        formatted
      }
      entities {
        ...ReportSubCommentaryTableFields
      }
    }
  }
`;

/** URL query parameter the report's filter is persisted under */
const IRS_CODES_REPORT_PARAM = 'irsCodesReportFilters';

type IrsCodesReportFilter = {
  fromDate: TimelessDateString;
  toDate: TimelessDateString;
};

const timelessDateString = z.custom<TimelessDateString>(
  value => typeof value === 'string' && TIMELESS_DATE_REGEX.test(value),
);

const filterSchema: z.ZodType<IrsCodesReportFilter> = z.object({
  fromDate: timelessDateString,
  toDate: timelessDateString,
});

/** The previous calendar year, the usual period for annual report review */
function defaultFilter(): IrsCodesReportFilter {
  const year = new Date().getFullYear() - 1;
  return {
    fromDate: `${year}-01-01` as TimelessDateString,
    toDate: `${year}-12-31` as TimelessDateString,
  };
}

/**
 * Ledger sums for a period, grouped by IRS code, then by the financial entities assigned to the
 * code (entities without one are grouped under Misc), with each entity's ledger records.
 */
export function IrsCodesReport(): ReactElement {
  const [storedFilter, setFilter] = useUrlFilterState<IrsCodesReportFilter>(
    IRS_CODES_REPORT_PARAM,
    filterSchema,
  );
  const filter = useMemo<IrsCodesReportFilter>(
    () => ({ ...defaultFilter(), ...storedFilter }),
    [storedFilter],
  );

  const [{ data, fetching, error }] = useQuery({
    query: IrsCodesReportScreenDocument,
    variables: { fromDate: filter.fromDate, toDate: filter.toDate },
    pause: filter.fromDate > filter.toDate,
  });
  const records = data?.irsCodesReport;

  const onDateChange = (key: keyof IrsCodesReportFilter, date?: TimelessDateString | null) => {
    if (date && date !== filter[key]) {
      setFilter(normalizeFilter({ ...filter, [key]: date }));
    }
  };

  return (
    <PageLayout
      title="IRS Codes Report"
      description="Ledger sums by IRS code for a period, with the financial entities assigned to each code"
    >
      <div className="flex flex-col gap-6 pb-10">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="irs-codes-from-date">From Date</Label>
            <DatePickerInput
              id="irs-codes-from-date"
              value={filter.fromDate}
              onChange={date => onDateChange('fromDate', date)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="irs-codes-to-date">To Date</Label>
            <DatePickerInput
              id="irs-codes-to-date"
              value={filter.toDate}
              onChange={date => onDateChange('toDate', date)}
            />
          </div>
        </div>

        {filter.fromDate > filter.toDate && (
          <Alert variant="destructive">
            <AlertTitle>Invalid period</AlertTitle>
            <AlertDescription>From date must be before or equal to to date.</AlertDescription>
          </Alert>
        )}

        {fetching && !records && <AccounterBarSpinner className="mx-auto h-12 w-40" />}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not load the report</AlertTitle>
            <AlertDescription>{error.graphQLErrors[0]?.message ?? error.message}</AlertDescription>
          </Alert>
        )}

        {records && (
          <div className={fetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <Table className="[&>tbody>tr:nth-child(odd)]:bg-gray-50">
              <TableHeader>
                <TableRow>
                  <TableHead>IRS Code</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No ledger records in this period
                    </TableCell>
                  </TableRow>
                )}
                {records.map(record => (
                  <ReportSubCommentaryRow
                    key={record.id}
                    subCommentaryData={record.entities}
                    dataRow={button => (
                      <TableRow>
                        <TableCell className="font-medium">{record.irsCode ?? 'Misc'}</TableCell>
                        <TableCell>
                          {record.irsCode === null ? 'No IRS code' : record.label}
                        </TableCell>
                        <TableCell>{record.amount.formatted}</TableCell>
                        <TableCell>{button}</TableCell>
                      </TableRow>
                    )}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
