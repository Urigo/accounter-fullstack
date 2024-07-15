import type { RawVatReportRecord } from '@modules/reports/helpers/vat-report.helper';

export function getVatDataFromVatReportRecords(records: Array<RawVatReportRecord>) {
  return records.reduce(
    (acc, { roundedVATToAdd, localVatAfterDeduction }) => {
      acc[0] += localVatAfterDeduction ?? 0;
      acc[1] += roundedVATToAdd ?? 0;
      return acc;
    },
    [0, 0],
  );
}
