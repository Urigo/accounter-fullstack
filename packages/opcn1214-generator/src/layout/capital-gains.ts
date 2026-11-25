/** Record types of the capital-gains appendices (SPEC §3.7): record 30xx for symbol xx. */
import { CAPITAL_GAINS_SYMBOLS, type CapitalGainsSymbol } from '../model/codes.generated.js';
import type { RecordType } from './types.js';

/** The record type of a capital-gains appendix: 3000 + its transaction symbol. */
export type CapitalGainsRecordType = `30${CapitalGainsSymbol}` & RecordType;

/** The record type of the capital-gains appendices of `symbol` (SPEC §3.7). */
export function capitalGainsRecordType(symbol: CapitalGainsSymbol): CapitalGainsRecordType {
  return `30${symbol}`;
}

const CAPITAL_GAINS_RECORD_TYPES: ReadonlySet<RecordType> = new Set(
  CAPITAL_GAINS_SYMBOLS.map(capitalGainsRecordType),
);

/** True for the ten capital-gains record types (3027 … 3077). */
export function isCapitalGainsRecordType(type: RecordType): type is CapitalGainsRecordType {
  return CAPITAL_GAINS_RECORD_TYPES.has(type);
}
