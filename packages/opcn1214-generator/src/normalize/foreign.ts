/** Normalizer of record 2000, the foreign appendix (SPEC §7.2, §3.5, §4.5). */
import type { YearLayout } from '../layout/types.js';
import type { ForeignAppendix } from '../model/input.js';
import type { NormalizedRecord } from '../model/normalized.js';
import type { ValidateOptions } from '../model/options.js';
import { codeSection, headerValues } from './fields.js';

export interface NormalizedForeignAppendix {
  record: NormalizedRecord;
  /** Codes whose input value 0 was omitted because the code is not zeroAllowed (SPEC §4.5). */
  omittedZeroCodes: string[];
}

/**
 * Record 2000 of `appendix`: the header values and the code-amount section (zero codes other than
 * the zeroAllowed 442 omitted). Amounts are rounded per `options.rounding` (SPEC §4.4) before zero
 * codes are omitted.
 */
export function normalizeForeignAppendix(
  appendix: ForeignAppendix,
  layout: YearLayout,
  options: ValidateOptions,
): NormalizedForeignAppendix {
  const def = layout.records['2000'];
  const { values, paths } = headerValues(
    def,
    0,
    {
      otherTaxableIncomeDescription: appendix.otherTaxableIncomeDescription,
      otherTaxableIncome: appendix.otherTaxableIncome,
      foreignTaxPaidOnOtherIncome: appendix.foreignTaxPaidOnOtherIncome,
      totalForeignTaxableIncome: appendix.totalForeignTaxableIncome,
      totalForeignLoss: appendix.totalForeignLoss,
      participationExemptionHoldingCompany: appendix.participationExemptionHoldingCompany,
      taxRefundDeclaration: appendix.taxRefundDeclaration,
      taxRefundDeclarationAmount: appendix.taxRefundDeclarationAmount,
    },
    options.rounding,
  );
  const amounts: Readonly<Partial<Record<string, number>>> = appendix.amounts;
  const section = codeSection(def, 0, amounts, options.rounding);
  return {
    record: {
      recordType: '2000',
      index: 0,
      values,
      codes: section.codes,
      countries: [],
      paths: { ...paths, ...section.paths },
    },
    omittedZeroCodes: section.omittedZeroCodes,
  };
}
