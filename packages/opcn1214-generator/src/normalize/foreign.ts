/**
 * Normalizer of the foreign appendix: record 2000 (SPEC §7.2, §3.5, §4.5) and its country
 * breakdowns, records 2200 (SPEC §3.6).
 */
import { COUNTRY_INCOME_SHAPE } from '../codec/sections.js';
import { countryKey } from '../layout/countries.js';
import type { YearLayout } from '../layout/types.js';
import type { CountryBreakdown, ForeignAppendix } from '../model/input.js';
import type { NormalizedRecord } from '../model/normalized.js';
import type { ValidateOptions } from '../model/options.js';
import { codeSection, headerValues, roundAmount } from './fields.js';
import { BREAKDOWN_CODE_KEY, countryEntryKey, incomeEntryKey, pathFor } from './paths.js';

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

/** A country code of 1–3 digits, which the file writes zero-padded (SPEC §3.6). */
const SHORT_COUNTRY_CODE = /^\d{1,3}$/;

/**
 * The model value of an input country code: its layout key (`countryKey`: '40' → '040') for 1–3
 * digits, otherwise the input as given, for foreign.breakdown.country.unknown to report.
 */
function modelCountry(country: string): string {
  return SHORT_COUNTRY_CODE.test(country) ? countryKey(country) : country;
}

/**
 * The 2200 records of `appendix.countryBreakdown`, one per breakdown, in ascending code order and
 * indexed in that order (SPEC §3.3): 2200@137 is the code (SPEC §7.4), 2200@140 the deductions;
 * each country entry keeps its input order, the country as modelCountry gives it and the income
 * rounded per `options.rounding` (SPEC §4.4). Paths per pathFor (record 2200).
 */
export function normalizeCountryBreakdowns(
  appendix: ForeignAppendix,
  layout: YearLayout,
  options: ValidateOptions,
): NormalizedRecord[] {
  const def = layout.records['2200'];
  const breakdowns: Readonly<Partial<Record<string, CountryBreakdown>>> =
    appendix.countryBreakdown ?? {};
  return Object.keys(breakdowns)
    .sort()
    .flatMap(code => {
      const breakdown = breakdowns[code];
      return breakdown ? [{ code, breakdown }] : [];
    })
    .map(({ code, breakdown }, index): NormalizedRecord => {
      const inputIndex = Number(code);
      const { values, paths } = headerValues(
        def,
        inputIndex,
        {
          [BREAKDOWN_CODE_KEY]: inputIndex,
          deductionsOffsetsAndExemptions: breakdown.deductionsOffsetsAndExemptions,
        },
        options.rounding,
      );
      const countries = breakdown.countries.map((entry, entryIndex) => {
        for (const key of [countryEntryKey(entryIndex), incomeEntryKey(entryIndex)]) {
          paths[key] = pathFor('2200', inputIndex, key);
        }
        return {
          country: modelCountry(entry.country),
          income: roundAmount(COUNTRY_INCOME_SHAPE.kind, entry.income, options.rounding),
        };
      });
      return { recordType: '2200', index, values, codes: new Map(), countries, paths };
    });
}
