/** Record 3063: capital gains from securities under section 6 (SPEC §7.2, p.46–47). */
import type { Primitive } from '../../codec/types.js';
import type { Section6SecuritiesAppendix } from '../../model/input.js';

/** Header keys of record 3063 that are members of the appendix (137 and 139 are derived). */
export const SECTION6_INPUT_KEYS = ['foreignAsset', 'lossesCarriedForward'] as const;

/** The header input values of the 3063 record of `appendix`, by FieldDef.key (derived ones aside). */
export function section6Header(appendix: Section6SecuritiesAppendix): Record<string, Primitive> {
  return {
    foreignAsset: appendix.foreignAsset,
    lossesCarriedForward: appendix.lossesCarriedForward,
  };
}
