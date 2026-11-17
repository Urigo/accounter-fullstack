/** Normalizer of records 1020, one per shareholder (SPEC §7.2, §7.4). */
import type { YearLayout } from '../layout/types.js';
import type { Shareholder } from '../model/input.js';
import type { NormalizedRecord } from '../model/normalized.js';
import { headerValues } from './fields.js';

/** One 1020 record per shareholder, in input order; serialNumber is the 1-based index. */
export function normalizeShareholders(
  shareholders: readonly Shareholder[],
  layout: YearLayout,
): NormalizedRecord[] {
  const def = layout.records['1020'];
  return shareholders.map((shareholder, index) => ({
    recordType: '1020',
    index,
    ...headerValues(def, index, {
      serialNumber: index + 1,
      idNumber: shareholder.idNumber,
      fullName: shareholder.fullName,
      isControllingShareholder: shareholder.isControllingShareholder,
      dividendRightsPercent: shareholder.dividendRightsPercent,
      votingRightsPercent: shareholder.votingRightsPercent,
      otherRightsPercent: shareholder.otherRightsPercent,
      isMaterialShareholder: shareholder.isMaterialShareholder,
      salaryMonths1To9: shareholder.salaryMonths1To9,
      salaryMonths10To12: shareholder.salaryMonths10To12,
      otherPayments: shareholder.otherPayments,
    }),
    codes: new Map(),
    countries: [],
  }));
}
