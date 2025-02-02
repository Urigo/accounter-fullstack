import { ReactElement, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { YearPickerInput } from '@mantine/dates';
import { YearlyLedgerDocument } from '../../../gql/graphql.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PageLayout } from '../../layout/page-layout.js';
import { DownloadCSV } from './download-csv.js';
import { YearlyLedgerReportTable } from './table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query YearlyLedger($year: Int!) {
    yearlyLedgerReport(year: $year) {
      id
      ...YearlyLedgerReportTable
      ...LedgerCsvFields
    }
  }
`;

export const YearlyLedgerReport = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [year, setYear] = useState<number>(new Date().getFullYear() - 1);

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: YearlyLedgerDocument,
    variables: {
      year,
    },
  });

  const reportData = data?.yearlyLedgerReport;

  useEffect(() => {
    setFiltersContext(
      <div className="flex items-center justify-end space-x-2 py-4">
        <YearPickerInput
          value={new Date(year, 0, 1)}
          onChange={date => date && setYear(date?.getFullYear())}
          popoverProps={{ withinPortal: true }}
          minDate={new Date(2010, 0, 1)}
          maxDate={new Date()}
        />
        <DownloadCSV data={reportData} year={year} />
      </div>,
    );
  }, [year, fetching, setFiltersContext, reportData]);

  return (
    <PageLayout title="Yearly Ledger Report">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : reportData ? (
        <YearlyLedgerReportTable data={reportData} />
      ) : (
        <div className="rounded-md border h-24 text-center">No results.</div>
      )}
    </PageLayout>
  );
};
