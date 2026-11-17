/**
 * Control record 9999 (SPEC §3.8): always derived from the records of the report (SPEC §7.4).
 */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import type { RecordType } from '../layout/types.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';

/** The ten capital-gains appendix record types (SPEC §3.7). */
const CAPITAL_GAINS_TYPES: ReadonlySet<RecordType> = new Set([
  '3027',
  '3050',
  '3051',
  '3054',
  '3060',
  '3063',
  '3064',
  '3065',
  '3066',
  '3077',
]);

type Count = (records: readonly NormalizedRecord[]) => number;

function countOf(type: RecordType): Count {
  return records => records.filter(record => record.recordType === type).length;
}

/** Value of each 9999 field, by FieldDef.key. */
const COUNTS: Readonly<Record<string, Count>> = {
  // One report per file; batches carry one 9999 per report (SPEC §3.1).
  reportCount: () => 1,
  relatedCompanyCount: countOf('1010'),
  shareholderCount: countOf('1020'),
  // `01` if a foreign appendix exists, else `00` (SPEC §15 A-14).
  foreignAppendixCount: records => (countOf('2000')(records) > 0 ? 1 : 0),
  capitalGainsAppendixCount: records =>
    records.filter(record => CAPITAL_GAINS_TYPES.has(record.recordType)).length,
  foreignCountryRecordCount: countOf('2200'),
  rdInvestmentRecordCount: countOf('1030'),
};

/**
 * The 9999 record of `report`: one value per field of the 9999 layout, counted from
 * `report.records`. Throws Opcn1214InternalError for a 9999 field this function cannot derive.
 */
export function buildControlRecord(report: NormalizedReport): NormalizedRecord {
  const values: Record<string, Primitive> = {};
  for (const field of report.layout.records['9999'].fields) {
    const count = COUNTS[field.key];
    if (!count) {
      throw new Opcn1214InternalError(`No derivation for record 9999 field ${field.key}`);
    }
    values[field.key] = count(report.records);
  }
  return { recordType: '9999', index: 0, values, codes: new Map(), countries: [], paths: {} };
}
