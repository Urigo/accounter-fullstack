/**
 * Control record 9999 (SPEC §3.8): always derived from the records of the report (SPEC §7.4).
 */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import { isCapitalGainsRecordType } from '../layout/capital-gains.js';
import type { RecordType, YearLayout } from '../layout/types.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';

type Count = (types: readonly RecordType[]) => number;

function countOf(type: RecordType): Count {
  return types => types.filter(recordType => recordType === type).length;
}

/** Value of each 9999 field, by FieldDef.key, from the record types of the report. */
const COUNTS: Readonly<Record<string, Count>> = {
  // Always 01 (p.60: only 1): every report ends with its own 9999, batches included (p.1).
  reportCount: () => 1,
  relatedCompanyCount: countOf('1010'),
  shareholderCount: countOf('1020'),
  // `01` if a foreign appendix exists, else `00` (SPEC §15 A-14).
  foreignAppendixCount: types => (countOf('2000')(types) > 0 ? 1 : 0),
  capitalGainsAppendixCount: types => types.filter(isCapitalGainsRecordType).length,
  foreignCountryRecordCount: countOf('2200'),
  rdInvestmentRecordCount: countOf('1030'),
};

/**
 * The value of every field of the 9999 layout (by FieldDef.key) for a report made of records of
 * `types` (9999 excluded). Shared by generation and by the parser's count check. Throws
 * Opcn1214InternalError for a 9999 field this function cannot derive.
 */
export function controlValues(
  layout: YearLayout,
  types: readonly RecordType[],
): Record<string, number> {
  const values: Record<string, number> = {};
  for (const field of layout.records['9999'].fields) {
    const count = COUNTS[field.key];
    if (!count) {
      throw new Opcn1214InternalError(`No derivation for record 9999 field ${field.key}`);
    }
    values[field.key] = count(types);
  }
  return values;
}

/**
 * The 9999 record of `report`: one value per field of the 9999 layout, counted from
 * `report.records`. Throws Opcn1214InternalError for a 9999 field this function cannot derive.
 */
export function buildControlRecord(report: NormalizedReport): NormalizedRecord {
  const values: Record<string, Primitive> = controlValues(
    report.layout,
    report.records.map(record => record.recordType),
  );
  return { recordType: '9999', index: 0, values, codes: new Map(), countries: [], paths: {} };
}
