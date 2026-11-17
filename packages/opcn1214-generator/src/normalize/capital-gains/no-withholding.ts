/**
 * Records 3065 (form 1322, p.50–52) and 3066 (form 1326, p.53–54): capital gains from securities
 * without tax withholding (SPEC §7.2). 3065 is the securities header (securities.ts) with a
 * withholding status; 3066 is a short variant. Their "מספר בתל"ם" sequence is derived (index.ts).
 */
import type { Primitive } from '../../codec/types.js';
import type { NoWithholding1322Appendix, NoWithholding1326Appendix } from '../../model/input.js';
import { enumCode, WITHHOLDING_STATUS_CODES } from '../enums.js';
import { SECURITIES_INPUT_KEYS, securitiesHeader } from './securities.js';

/** Header keys of record 3065 that are scalar members of the appendix (besides `withholders`). */
export const NO_WITHHOLDING_1322_INPUT_KEYS = [
  ...SECURITIES_INPUT_KEYS,
  'withholdingStatus',
] as const;

/** Header keys of record 3066 that are members of the appendix (137, 139 and 154 are derived). */
export const NO_WITHHOLDING_1326_INPUT_KEYS = [
  'foreignAsset',
  'withholdingStatus',
  'lossesCarriedForward',
] as const;

/**
 * The header input values of the 3065 record of `appendix`, by FieldDef key (derived ones aside):
 * the securities header (withholders included) and the withholding status code.
 */
export function noWithholding1322Header(
  appendix: NoWithholding1322Appendix,
): Record<string, Primitive> {
  return {
    ...securitiesHeader(appendix),
    withholdingStatus: enumCode(WITHHOLDING_STATUS_CODES, appendix.withholdingStatus),
  };
}

/** The header input values of the 3066 record of `appendix`, by FieldDef key (derived ones aside). */
export function noWithholding1326Header(
  appendix: NoWithholding1326Appendix,
): Record<string, Primitive> {
  return {
    foreignAsset: appendix.foreignAsset,
    withholdingStatus: enumCode(WITHHOLDING_STATUS_CODES, appendix.withholdingStatus),
    lossesCarriedForward: appendix.lossesCarriedForward,
  };
}
