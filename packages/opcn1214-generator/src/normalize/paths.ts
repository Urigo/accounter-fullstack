/**
 * Input paths of model keys (SPEC §7.3, §9.1 path grammar). Shared by the normalizer, which fills
 * NormalizedRecord.paths, and the parser, which reports issues against the reconstructed input.
 */
import { Opcn1214InternalError } from '../errors.js';
import type { RecordType } from '../layout/types.js';
import { DERIVED_MAIN_CODES } from '../model/codes.generated.js';

/** Prefix of code-amount keys in NormalizedRecord.paths: `code:${code}`. */
const CODE_KEY_PREFIX = 'code:';

/** Derived header keys (`(derived) ` rows of fields.csv) of the records mapped here. */
const DERIVED_KEYS: Readonly<Partial<Record<RecordType, readonly string[]>>> = {
  '1000': ['hasForeignAppendix'],
  '1020': ['serialNumber'],
};

const DERIVED_CODES: Readonly<Partial<Record<RecordType, readonly string[]>>> = {
  '1000': DERIVED_MAIN_CODES,
};

/** The key of a code in NormalizedRecord.paths. */
export function codeKey(code: string): string {
  return CODE_KEY_PREFIX + code;
}

/**
 * The input path of a model key: a header key (FieldDef.key) or a code key (`code:${code}`) of the
 * record of type `recordType` produced from the `inputIndex`-th input element (0-based; 0 for
 * record 1000).
 *
 * - Record 1000: a header key is its own dotted input path (`company.phone.number`); a code maps to
 *   `amounts["018"]`.
 * - Record 1020: a header key maps to `shareholders[i].<key>`.
 * - Derived values have no input path and map to `''` (report level): derived header keys
 *   (1000@832 `hasForeignAppendix`, 1020@137 `serialNumber`) and derived codes (SPEC §7.4: 008,
 *   028, 273, 277, 278, 280, 297). A derived value whose key is itself an input property
 *   (1000@833 `declarations.hasCapitalGainsAppendix`) keeps that property's path.
 *
 * Throws Opcn1214InternalError for a record type without a mapping.
 */
export function pathFor(recordType: RecordType, inputIndex: number, key: string): string {
  const isCode = key.startsWith(CODE_KEY_PREFIX);
  const code = key.slice(CODE_KEY_PREFIX.length);
  if (
    isCode ? DERIVED_CODES[recordType]?.includes(code) : DERIVED_KEYS[recordType]?.includes(key)
  ) {
    return '';
  }
  switch (recordType) {
    case '1000':
      return isCode ? `amounts["${code}"]` : key;
    case '1020':
      return `shareholders[${inputIndex}].${key}`;
    default:
      throw new Opcn1214InternalError(`No input paths are defined for record ${recordType}`);
  }
}
