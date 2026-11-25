import {
  getLayout,
  supportedTaxYears,
  type MainFormInputCode,
} from '@accounter/opcn1214-generator';
import type { AnnualTaxData } from '../../reports/helpers/annual-tax-data.helper.js';
import type { Report1214IssueProto, Report1214ProfileProto } from '../types.js';

/** Rule IDs of the mapping issues raised while computing record 1000 amounts. */
export const REPORT_1214_AMOUNT_RULES = {
  /** warning: the amounts that need the books were not computed (the message says why). */
  computationSkipped: 'accounter.amounts.computationSkipped',
  /** warning: loading the books or the tax computation failed; only overrides are used. */
  computationFailed: 'accounter.amounts.computationFailed',
  /** warning: a computed amount was not a finite number and was left out (a bug, not user data). */
  computedInvalid: 'accounter.amounts.computedInvalid',
} as const;

/** What the computed amounts are derived from. */
export interface Report1214AmountsData {
  year: number;
  /** The books of the year (`loadAnnualTaxData`); `null` when they were not loaded. */
  tax: AnnualTaxData | null;
  profile: Pick<Report1214ProfileProto, 'rdInvestments'>;
}

/** How Accounter computes one record 1000 code. */
export interface Report1214CodeSource {
  /** The code's Hebrew name, as the layout specification (1214-2024.pdf) gives it. */
  label: string;
  /** Page of the layout specification that defines the code. */
  specRef: `p.${number}`;
  /** Whether `compute` reads `data.tax`; the books are loaded only when some code needs them. */
  requiresTaxData: boolean;
  /** The unrounded amount, or `undefined` when Accounter has no value for the code. */
  compute: (data: Report1214AmountsData) => number | undefined;
}

/**
 * The record 1000 codes Accounter fills in by itself, each with the spec page that names it.
 *
 * A code is listed only when the layout specification (`opcn1214-generator/documentation/
 * specifications/1214-2024.pdf`) states its meaning unambiguously AND Accounter holds exactly that
 * value. The code tables (p.13–20) give most codes no name at all, only a length, so their meaning
 * cannot be verified from the specification; those codes (including the required 018, 072, 081,
 * 094 and 263, the tax-rate codes 020/030 and the tax-advance and loss carry-forward amounts) are
 * left to the profile's amount overrides until each mapping is confirmed with the accountant.
 */
export const CODE_SOURCES: Partial<Record<MainFormInputCode, Report1214CodeSource>> = {
  // verified p.17: "בחלק טז' – סך השקעות בחברות מו"פ" (part 16: total investments in R&D
  // companies; record 1030 lists them). The generator's main.rd.total rule checks this code
  // against the 1030 records, each rounded to whole shekels, so it is summed the same way.
  '165': {
    label: 'סך השקעות בחברות מו"פ',
    specRef: 'p.17',
    requiresTaxData: false,
    compute: ({ profile }) => {
      if (profile.rdInvestments.length === 0) {
        return undefined;
      }
      return profile.rdInvestments.reduce(
        (sum, { investmentAmount }) =>
          Number.isFinite(investmentAmount) ? sum + Math.round(investmentAmount) : sum,
        0,
      );
    },
  },
};

/** Whether any code computed for `year` needs the books (`loadAnnualTaxData`). */
export function codeSourcesNeedTaxData(year: number): boolean {
  const inputCodes = layoutInputCodes(year);
  return Object.entries(CODE_SOURCES).some(
    ([code, source]) => source?.requiresTaxData && inputCodes?.has(code),
  );
}

/** The record 1000 input (non-derived) codes of `year`, with whether each allows 0. */
function layoutInputCodes(year: number): Map<string, { zeroAllowed: boolean }> | null {
  if (!supportedTaxYears().includes(year)) {
    return null;
  }
  return new Map(
    getLayout(year)
      .records['1000'].codes.filter(def => !def.derived)
      .map(def => [def.code, { zeroAllowed: def.zeroAllowed }]),
  );
}

/**
 * The record 1000 amounts Accounter computes for a tax year (see `CODE_SOURCES`), rounded to whole
 * shekels. Pure.
 *
 * - A code without a value (`compute` returns `undefined`, or needs the books while `tax` is
 *   `null`) is left out.
 * - 0 is kept only for a code the layout allows 0 in; the generator drops other zeros anyway.
 * - A code the year's layout lacks or derives is never computed.
 * - A non-finite result is left out with a `computedInvalid` warning.
 */
export function computeMainFormAmounts(data: Report1214AmountsData): {
  amounts: Partial<Record<MainFormInputCode, number>>;
  issues: Report1214IssueProto[];
} {
  const amounts: Partial<Record<MainFormInputCode, number>> = {};
  const issues: Report1214IssueProto[] = [];
  const inputCodes = layoutInputCodes(data.year);
  if (!inputCodes) {
    return { amounts, issues };
  }
  for (const [code, source] of Object.entries(CODE_SOURCES)) {
    const layoutCode = inputCodes.get(code);
    if (!source || !layoutCode || (source.requiresTaxData && !data.tax)) {
      continue;
    }
    const value = source.compute(data);
    if (value === undefined) {
      continue;
    }
    if (!Number.isFinite(value)) {
      issues.push({
        ruleId: REPORT_1214_AMOUNT_RULES.computedInvalid,
        severity: 'warning',
        path: `amounts["${code}"]`,
        code,
        message: `The computed amount of code ${code} (${source.label}) is not a number and was left out: set it in the 1214 profile`,
      });
      continue;
    }
    const rounded = Math.round(value) || 0; // no -0
    if (rounded === 0 && !layoutCode.zeroAllowed) {
      continue;
    }
    amounts[code as MainFormInputCode] = rounded;
  }
  return { amounts, issues };
}
