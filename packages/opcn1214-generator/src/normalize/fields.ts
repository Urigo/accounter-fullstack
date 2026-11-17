/** Header values of a normalized record: model conversion by kind and input paths. */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import type { FieldDef, RecordDef } from '../layout/types.js';
import type { NormalizedRecord } from '../model/normalized.js';
import { pathFor } from './paths.js';
import { normalizeText } from './text.js';

/**
 * The model value of a header field (value conventions: IMPLEMENTATION_PLAN.md §1.2). Text kinds
 * go through normalizeText; an empty string (after normalization, for text kinds) is absent
 * (SPEC §4.1). Every other value is kept as given, including a value of the wrong type, so the
 * field rules report it.
 */
function modelValue(field: FieldDef, raw: Primitive): Primitive {
  const value =
    typeof raw === 'string' && (field.kind === 'text' || field.kind === 'hebrewText')
      ? normalizeText(raw)
      : raw;
  return value === '' ? undefined : value;
}

/**
 * Header `values` and `paths` of the record of type `def.type` produced from the
 * `inputIndex`-th input element. `raw` maps FieldDef keys to input values; absent values are
 * left out of both maps. Throws Opcn1214InternalError for a key that is not a non-filler field of
 * the record.
 */
export function headerValues(
  def: RecordDef,
  inputIndex: number,
  raw: Readonly<Record<string, Primitive>>,
): Pick<NormalizedRecord, 'values' | 'paths'> {
  const fields = new Map(def.fields.map(field => [field.key, field]));
  const values: Record<string, Primitive> = {};
  const paths: Record<string, string> = {};
  for (const [key, input] of Object.entries(raw)) {
    const field = fields.get(key);
    if (!field || field.kind === 'filler') {
      throw new Opcn1214InternalError(`Record ${def.type} has no field "${key}"`);
    }
    const value = modelValue(field, input);
    if (value !== undefined) {
      values[key] = value;
      paths[key] = pathFor(def.type, inputIndex, key);
    }
  }
  return { values, paths };
}
