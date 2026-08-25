import { format, subMonths } from 'date-fns';
import type { Pcn874RecordType } from '../../../gql/graphql.js';
import type { TimelessDateString } from '../../../helpers/index.js';

/**
 * The month the VAT report opens on by default: the previous month. The current month is still
 * ongoing, so its report is incomplete - the previous month is the one users actually work on.
 * Anchored to the 15th, matching how `monthDate` is represented throughout the report filters.
 */
export function getDefaultVatReportMonth(): TimelessDateString {
  return format(subMonths(new Date(), 1), 'yyyy-MM-15') as TimelessDateString;
}

export function getRecordTypeName(recordType: Pcn874RecordType): string {
  switch (recordType) {
    case 'C':
    case 'M':
      return 'Self Invoice';
    case 'H':
      return 'Single Doc By Law';
    case 'I':
      return 'Palestinian Customer';
    case 'K':
      return 'Petty Cash';
    case 'L1':
      return 'Unidentified Customer';
    case 'L2':
      return 'Unidentified Zero or Exempt';
    case 'P':
      return 'Palestinian Supplier';
    case 'R':
      return 'Import';
    case 'S1':
    case 'T':
      return 'Regular';
    case 'S2':
      return 'Zero or Exempt';
    case 'Y':
      return 'Export';
    default:
      return 'Unknown';
  }
}
