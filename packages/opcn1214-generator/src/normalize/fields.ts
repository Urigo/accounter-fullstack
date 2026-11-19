/** Header values of a normalized record: model conversion by kind and input paths. */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import type { CodeKind, FieldDef, FieldKind, RecordDef } from '../layout/types.js';
import type { NormalizedRecord } from '../model/normalized.js';
import type { ValidateOptions } from '../model/options.js';
import { codeKey, pathFor } from './paths.js';
import { normalizeText } from './text.js';

/** Kinds the `rounding` option applies to (SPEC §4.4). */
const ROUNDED_KINDS: ReadonlySet<FieldKind | CodeKind> = new Set(['amount', 'amountX']);

/**
 * `value` of a field or code of `kind`, rounded half away from zero when `rounding` is 'halfUp'
 * and the kind is `amount`/`amountX` (SPEC §4.4); otherwise unchanged, so that field.integer
 * reports a fraction.
 */
export function roundAmount(
  kind: FieldKind | CodeKind,
  value: number,
  rounding: ValidateOptions['rounding'],
): number {
  if (rounding !== 'halfUp' || !ROUNDED_KINDS.has(kind)) {
    return value;
  }
  const magnitude = Math.round(Math.abs(value));
  return value < 0 && magnitude !== 0 ? -magnitude : magnitude;
}

/**
 * The model value of a header field (value conventions: IMPLEMENTATION_PLAN.md §1.2). Text kinds
 * go through normalizeText and amounts through roundAmount; an empty string (after normalization,
 * for text kinds) is absent (SPEC §4.1). Every other value is kept as given, including a value of
 * the wrong type, so the field rules report it.
 */
function modelValue(
  field: FieldDef,
  raw: Primitive,
  rounding: ValidateOptions['rounding'],
): Primitive {
  if (typeof raw === 'number') {
    return roundAmount(field.kind, raw, rounding);
  }
  const value =
    typeof raw === 'string' && (field.kind === 'text' || field.kind === 'hebrewText')
      ? normalizeText(raw)
      : raw;
  return value === '' ? undefined : value;
}

/**
 * Header `values` and `paths` of the record of type `def.type` produced from the
 * `inputIndex`-th input element. `raw` maps FieldDef keys to input values; absent values are
 * left out of both maps. `rounding` is the option of SPEC §4.4. Throws Opcn1214InternalError for
 * a key that is not a non-filler field of the record.
 */
export function headerValues(
  def: RecordDef,
  inputIndex: number,
  raw: Readonly<Record<string, Primitive>>,
  rounding: ValidateOptions['rounding'],
): Pick<NormalizedRecord, 'values' | 'paths'> {
  const fields = new Map(def.fields.map(field => [field.key, field]));
  const values: Record<string, Primitive> = {};
  const paths: Record<string, string> = {};
  for (const [key, input] of Object.entries(raw)) {
    const field = fields.get(key);
    if (!field || field.kind === 'filler') {
      throw new Opcn1214InternalError(`Record ${def.type} has no field "${key}"`);
    }
    const value = modelValue(field, input, rounding);
    if (value !== undefined) {
      values[key] = value;
      paths[key] = pathFor(def.type, inputIndex, key);
    }
  }
  return { values, paths };
}

/**
 * The code-amount section of the record of type `def.type` produced from the `inputIndex`-th input
 * element: `amounts` maps codes to input values (derived codes included, by the caller). Values
 * are rounded per `rounding` (SPEC §4.4), then a 0 is dropped for every code that is not
 * zeroAllowed and listed in `omittedZeroCodes` (SPEC §4.5). Keys that are not codes of the record
 * are ignored (the shape stage reports them). Codes come out in ascending order.
 */
export function codeSection(
  def: RecordDef,
  inputIndex: number,
  amounts: Readonly<Partial<Record<string, number>>>,
  rounding: ValidateOptions['rounding'],
): Pick<NormalizedRecord, 'codes' | 'paths'> & { omittedZeroCodes: string[] } {
  const codes = new Map<string, number>();
  const paths: Record<string, string> = {};
  const omittedZeroCodes: string[] = [];
  for (const { code, kind, zeroAllowed } of def.codes) {
    const input = amounts[code];
    if (input === undefined) {
      continue;
    }
    const value = roundAmount(kind, input, rounding);
    if (value === 0 && !zeroAllowed) {
      omittedZeroCodes.push(code);
      continue;
    }
    codes.set(code, value);
    paths[codeKey(code)] = pathFor(def.type, inputIndex, codeKey(code));
  }
  return { codes, paths, omittedZeroCodes };
}
