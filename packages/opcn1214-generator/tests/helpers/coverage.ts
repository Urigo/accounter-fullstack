/**
 * Normalizer coverage (SPEC §13.3): which header keys of a record type the normalizer never
 * produced a value for.
 */
import type { RecordDef } from '../../src/layout/types.js';
import type { NormalizedRecord } from '../../src/model/normalized.js';

/**
 * The non-filler header keys of `def`, in position order, that have no value in any of the
 * `records` of its type.
 */
export function unmappedHeaderKeys(def: RecordDef, records: readonly NormalizedRecord[]): string[] {
  const own = records.filter(record => record.recordType === def.type);
  return def.fields
    .filter(field => field.kind !== 'filler')
    .map(field => field.key)
    .filter(key => own.every(record => record.values[key] === undefined));
}
