/** Normalizer of records 1030, one per R&D investment (SPEC §7.2, §7.4). */
import type { YearLayout } from '../layout/types.js';
import type { RdInvestment } from '../model/input.js';
import type { NormalizedRecord } from '../model/normalized.js';
import type { ValidateOptions } from '../model/options.js';
import { headerValues } from './fields.js';

/** 1030@137 "שייכות": always 1, company (p.25). */
const AFFILIATION_COMPANY = 1;

/**
 * One 1030 record per R&D investment, in input order; affiliation is always 1 (company). Amounts
 * are rounded per `options.rounding` (SPEC §4.4).
 */
export function normalizeRdInvestments(
  investments: readonly RdInvestment[],
  layout: YearLayout,
  options: ValidateOptions,
): NormalizedRecord[] {
  const def = layout.records['1030'];
  return investments.map((investment, index) => ({
    recordType: '1030',
    index,
    ...headerValues(
      def,
      index,
      {
        affiliation: AFFILIATION_COMPANY,
        companyName: investment.companyName,
        companyFileNumber: investment.companyFileNumber,
        investmentAmount: investment.investmentAmount,
      },
      options.rounding,
    ),
    codes: new Map(),
    countries: [],
  }));
}
