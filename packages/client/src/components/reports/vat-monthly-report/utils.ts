import type { Pcn874RecordType } from '../../../gql/graphql.js';

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
