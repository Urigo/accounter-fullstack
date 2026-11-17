/**
 * Enum literal ↔ code maps of the input model (SPEC §7.2): the normalizer writes the code, the
 * denormalizer reads the literal back.
 */
import type { Primitive } from '../codec/types.js';
import type {
  AssetLocation,
  Declarations,
  RelatedCompany,
  WithholdingStatus,
} from '../model/input.js';

/** A literal → code map of an enum input member. */
type EnumCodes<L extends string> = Readonly<Record<L, number>>;

/** 1000@834: 1 obliged to file form 6111, 2 not obliged, 3 not relevant. */
export const FORM_6111_OBLIGATION_CODES = {
  obliged: 1,
  notObliged: 2,
  notRelevant: 3,
} as const satisfies EnumCodes<NonNullable<Declarations['form6111Obligation']>>;

/** 1000@875: 1 consolidated under section 23, 2 consolidates with its parent, 3 not relevant. */
export const CONSOLIDATED_REPORT_CODES = {
  consolidatedUnderSection23: 1,
  consolidatesWithParent: 2,
  notRelevant: 3,
} as const satisfies EnumCodes<NonNullable<Declarations['consolidatedReport']>>;

/**
 * 1010@198: 1 parent, 2 subsidiary, 3 partnership, 4 corporation related to a kibbutz, 5 jointly
 * controlled company, 6 granddaughter company, 7 grandmother company, 8 other.
 */
export const RELATION_TYPE_CODES = {
  parent: 1,
  subsidiary: 2,
  partnership: 3,
  kibbutzRelatedCorporation: 4,
  jointlyControlled: 5,
  granddaughter: 6,
  grandmother: 7,
  other: 8,
} as const satisfies EnumCodes<RelatedCompany['relationType']>;

/**
 * 3065@146 and 3066@143 "מס במקור": 2 not withheld, gains accrued January–June of the tax year;
 * 3 not withheld, gains accrued July–December (SPEC §15 A-18). An absent status is written as 0.
 */
export const WITHHOLDING_STATUS_CODES = {
  notWithheldFirstHalf: 2,
  notWithheldSecondHalf: 3,
} as const satisfies EnumCodes<WithholdingStatus>;

/** 3027@193, 3051@192 and 3077@193 "מקום הנכס": 1 abroad, 2 Israel. */
export const ASSET_LOCATION_CODES = {
  abroad: 1,
  israel: 2,
} as const satisfies EnumCodes<AssetLocation>;

/** The enum header keys of the capital-gains appendices (members of the appendix) and their maps. */
export const CAPITAL_GAINS_ENUM_INPUTS: Readonly<Partial<Record<string, EnumCodes<string>>>> = {
  withholdingStatus: WITHHOLDING_STATUS_CODES,
  assetLocation: ASSET_LOCATION_CODES,
};

/** The enum header keys of record 1000 (each its own input path) and their maps. */
export const ENUM_INPUTS: Readonly<Partial<Record<string, EnumCodes<string>>>> = {
  'declarations.form6111Obligation': FORM_6111_OBLIGATION_CODES,
  'declarations.consolidatedReport': CONSOLIDATED_REPORT_CODES,
};

/**
 * The code of the enum input `value`. Any value that is not a literal of `codes` is kept as-is,
 * so field.enum reports it (IMPLEMENTATION_PLAN.md §1.2).
 */
export function enumCode(codes: EnumCodes<string>, value: Primitive): Primitive {
  if (typeof value === 'string' && Object.hasOwn(codes, value)) {
    return codes[value];
  }
  return value;
}

/** The literal of the enum `code`; a code without a literal (a parsed file) is kept as-is. */
export function enumLiteral(codes: EnumCodes<string>, code: Primitive): Primitive {
  const entry = Object.entries(codes).find(([, candidate]) => candidate === code);
  return entry ? entry[0] : code;
}
