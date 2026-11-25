/**
 * Enum literal ↔ code maps of the input model (SPEC §7.2): the normalizer writes the code, the
 * denormalizer reads the literal back.
 */
import type { Primitive } from '../codec/types.js';
import type { Declarations } from '../model/input.js';

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
