/**
 * Normalizer of the capital-gains appendices, records 30xx (SPEC §3.3, §3.7, §7.4, §15 A-7): their
 * order in the file, appendix numbers and the "מספר בתל"ם" sequence, shared by every appendix type.
 */
import { capitalGainsRecordType, type CapitalGainsRecordType } from '../../layout/capital-gains.js';
import type { YearLayout } from '../../layout/types.js';
import type { CapitalGainsAppendix } from '../../model/input.js';
import type { NormalizedRecord } from '../../model/normalized.js';
import type { ValidateOptions } from '../../model/options.js';
import { codeSection, headerValues } from '../fields.js';
import { SECTION6_INPUT_KEYS, section6Header } from './section6.js';
import { SECURITIES_INPUT_KEYS, securitiesHeader } from './securities.js';

/** The transaction symbols the input model has an appendix type for. */
export type CapitalGainsInputSymbol = CapitalGainsAppendix['symbol'];

/**
 * Header keys of each appendix type that are scalar members of the appendix, besides `symbol`,
 * `amounts` and `withholders` (the transaction symbol and appendix number are derived).
 */
export const CAPITAL_GAINS_INPUT_KEYS: Readonly<
  Record<CapitalGainsInputSymbol, readonly string[]>
> = {
  60: SECURITIES_INPUT_KEYS,
  63: SECTION6_INPUT_KEYS,
  64: SECURITIES_INPUT_KEYS,
};

/** The symbols whose appendix has `withholders`, header keys `withholders[i].*` (SPEC §7.3). */
const WITHHOLDING_SYMBOLS: ReadonlySet<CapitalGainsInputSymbol> = new Set([60, 64]);

/** True when appendices of `symbol` have `withholders` (records 3060, 3064). */
export function hasWithholders(symbol: CapitalGainsInputSymbol): boolean {
  return WITHHOLDING_SYMBOLS.has(symbol);
}

/** Header keys of the derived transaction symbol (30xx@137) and appendix number (30xx@139). */
const TRANSACTION_SYMBOL_KEY = 'transactionSymbol';
const APPENDIX_NUMBER_KEY = 'appendixNumber';

/** Where an appendix goes in the file (SPEC §3.3, §7.4). */
export interface CapitalGainsPlacement<T> {
  appendix: T;
  /** 0-based index of the appendix in the input list. */
  inputIndex: number;
  /** 30xx@139: 1-based among appendices of the same symbol, in emission order (SPEC §15 A-7). */
  appendixNumber: number;
  /** "מספר בתל"ם": 1-based among all capital-gains appendices, in emission order (SPEC §7.4). */
  sequenceNumber: number;
}

/**
 * The appendices in emission order: grouped by symbol (= record type) ascending, input order within
 * a symbol (SPEC §3.3, §15 A-7), each with its input index, appendix number and sequence number.
 */
export function placeCapitalGains<T extends { symbol: number }>(
  appendices: readonly T[],
): Array<CapitalGainsPlacement<T>> {
  const perSymbol = new Map<number, number>();
  return appendices
    .map((appendix, inputIndex) => ({ appendix, inputIndex }))
    .sort((a, b) => a.appendix.symbol - b.appendix.symbol || a.inputIndex - b.inputIndex)
    .map(({ appendix, inputIndex }, emissionIndex) => {
      const appendixNumber = (perSymbol.get(appendix.symbol) ?? 0) + 1;
      perSymbol.set(appendix.symbol, appendixNumber);
      return { appendix, inputIndex, appendixNumber, sequenceNumber: emissionIndex + 1 };
    });
}

/** The header input values of an appendix of any type, by FieldDef.key (derived ones aside). */
function headerInput(appendix: CapitalGainsAppendix) {
  switch (appendix.symbol) {
    case 60:
    case 64:
      return securitiesHeader(appendix);
    case 63:
      return section6Header(appendix);
  }
}

export interface NormalizedCapitalGains {
  /** In emission order (SPEC §3.3). */
  records: NormalizedRecord[];
  /** Codes whose input value 0 was omitted (no 30xx code is zeroAllowed, SPEC §4.5). */
  omittedZeroCodes: Array<{ record: CapitalGainsRecordType; recordIndex: number; code: string }>;
}

/**
 * The 30xx records of `appendices` in emission order (placeCapitalGains): each indexed among the
 * records of its type, with its input index, the derived symbol (30xx@137) and appendix number
 * (30xx@139), its header values and its code-amount section (amounts rounded per
 * `options.rounding`, SPEC §4.4, then zero codes omitted). Paths per pathFor (records 30xx).
 */
export function normalizeCapitalGains(
  appendices: readonly CapitalGainsAppendix[],
  layout: YearLayout,
  options: ValidateOptions,
): NormalizedCapitalGains {
  const omittedZeroCodes: NormalizedCapitalGains['omittedZeroCodes'] = [];
  const records = placeCapitalGains(appendices).map(
    ({ appendix, inputIndex, appendixNumber }): NormalizedRecord => {
      const recordType = capitalGainsRecordType(appendix.symbol);
      const def = layout.records[recordType];
      const index = appendixNumber - 1;
      const { values, paths } = headerValues(
        def,
        inputIndex,
        {
          [TRANSACTION_SYMBOL_KEY]: appendix.symbol,
          [APPENDIX_NUMBER_KEY]: appendixNumber,
          ...headerInput(appendix),
        },
        options.rounding,
      );
      const amounts: Readonly<Partial<Record<string, number>>> = appendix.amounts;
      const section = codeSection(def, inputIndex, amounts, options.rounding);
      for (const code of section.omittedZeroCodes) {
        omittedZeroCodes.push({ record: recordType, recordIndex: index, code });
      }
      return {
        recordType,
        index,
        inputIndex,
        values,
        codes: section.codes,
        countries: [],
        paths: { ...paths, ...section.paths },
      };
    },
  );
  return { records, omittedZeroCodes };
}
