/** Phone prefixes (SPEC §4.2, §10.2 field.phonePrefix): SHAAM deletes an invalid prefix (p.6). */
import { allowedPhonePrefixes } from '../codec/phone.js';
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import type { RecordDef } from '../layout/types.js';
import { makeIssue, type Issue } from '../validate/issue.js';
import { pathFor } from './paths.js';

/**
 * The model value of the phone-prefix field `key` of the record of type `def.type` produced from
 * the `inputIndex`-th input element: `prefix` when the field's layout values allow it (or absent: undefined
 * or ''). Any other prefix is dropped (undefined), and a field.phonePrefix warning is pushed onto
 * `notices`; for a required prefix the follow-up field.required is the error. Throws
 * Opcn1214InternalError for a key that is not a phone-prefix field of the record.
 */
export function phonePrefix(
  def: RecordDef,
  inputIndex: number,
  key: string,
  prefix: Primitive,
  notices: Issue[],
): Primitive {
  const field = def.fields.find(candidate => candidate.key === key);
  if (field?.kind !== 'phonePrefix') {
    throw new Opcn1214InternalError(`Record ${def.type} has no phone-prefix field "${key}"`);
  }
  // The field's layout values, as the phonePrefix codec reads them: one source for both.
  const allowed = allowedPhonePrefixes(field);
  if (
    prefix === undefined ||
    prefix === '' ||
    (typeof prefix === 'string' && allowed.includes(prefix))
  ) {
    return prefix;
  }
  notices.push(
    makeIssue('field.phonePrefix', {
      message: `Phone prefix ${JSON.stringify(prefix)} of ${key} (${def.type}@${field.position}) is not an allowed prefix; it is dropped.`,
      path: pathFor(def.type, inputIndex, key),
      recordType: def.type,
      recordIndex: inputIndex,
      field: { position: field.position, length: field.length, nameHe: field.nameHe },
      value: prefix,
      expected: `one of ${allowed.join(', ')}`,
      specRef: { page: field.specPage },
    }),
  );
  return undefined;
}
