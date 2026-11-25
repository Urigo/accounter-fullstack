export type * from './__generated__/types.js';
export type * from './__generated__/shareholders.types.js';

/** GraphQL `Shareholder` parent: a `shareholders` row with numeric columns as numbers. */
export interface ShareholderProto {
  id: string;
  ownerId: string;
  year: number;
  businessId: string | null;
  idNumber: string;
  fullName: string;
  isControllingShareholder: boolean;
  dividendRightsPercent: number | null;
  votingRightsPercent: number | null;
  otherRightsPercent: number | null;
  isMaterialShareholder: boolean | null;
  salaryMonths1To9: number | null;
  salaryMonths10To12: number | null;
  otherPayments: number | null;
  sortOrder: number;
}
