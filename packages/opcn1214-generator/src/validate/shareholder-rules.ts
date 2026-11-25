/**
 * Shareholder rules (SPEC §9.2 stage 4, §10.4): pure checks over the normalized 1020 records, so
 * they run on validated input and on parsed files alike.
 */
import { Opcn1214InternalError } from '../errors.js';
import type { FieldDef } from '../layout/types.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';
import { pathFor } from '../normalize/paths.js';
import { makeIssue, type Issue } from './issue.js';

type ReportRule = (report: NormalizedReport) => Issue[];

const DIVIDEND_RIGHTS = 'dividendRightsPercent';
const ID_NUMBER = 'idNumber';
/** 100.00 percent, in hundredths. */
const FULL_RIGHTS_HUNDREDTHS = 10_000;
/** Special shareholder IDs that many shareholders may share (p.22). */
const SHARED_IDS: ReadonlySet<string> = new Set(['999999964', '999999998']);

function shareholderRecords(report: NormalizedReport): NormalizedRecord[] {
  return report.records.filter(record => record.recordType === '1020');
}

function shareholderField(report: NormalizedReport, key: string): FieldDef {
  const field = report.layout.records['1020'].fields.find(def => def.key === key);
  if (!field) {
    throw new Opcn1214InternalError(`Record 1020 has no field "${key}"`);
  }
  return field;
}

/**
 * shareholders.dividendRights.total: when at least one shareholder states dividend rights, they
 * must total exactly 100 (p.23; SPEC §15 A-15). Each value is taken as written, rounded to
 * hundredths like field.percentRange and the encoder, and summed in hundredths, so 14.46 + 49.59 +
 * 35.95 is exactly 100 although the raw float sum is 100.00000000000001.
 */
function dividendRightsTotal(report: NormalizedReport): Issue[] {
  const stated = shareholderRecords(report)
    .map(record => record.values[DIVIDEND_RIGHTS])
    .filter(value => typeof value === 'number');
  if (stated.length === 0) {
    return [];
  }
  const hundredths = stated.reduce((sum, value) => sum + Math.round(value * 100), 0);
  if (hundredths === FULL_RIGHTS_HUNDREDTHS) {
    return [];
  }
  const total = hundredths / 100;
  return [
    makeIssue('shareholders.dividendRights.total', {
      message: `The shareholders' dividend rights total ${total}%; they must total 100%.`,
      path: 'shareholders',
      recordType: '1020',
      value: total,
      expected: '100',
      specRef: { page: shareholderField(report, DIVIDEND_RIGHTS).specPage },
    }),
  ];
}

/**
 * shareholders.duplicateId: an idNumber that an earlier shareholder already has, compared as written
 * (zero-padded to 9 digits), except the shared special IDs. One issue per repeat, at the repeating
 * shareholder.
 */
function duplicateId(report: NormalizedReport): Issue[] {
  const field = shareholderField(report, ID_NUMBER);
  const seen = new Set<string>();
  const issues: Issue[] = [];
  for (const record of shareholderRecords(report)) {
    const raw = record.values[ID_NUMBER];
    if (typeof raw !== 'string') {
      continue;
    }
    // As written to the file, zero-padded to 9 digits: '12345678' and '012345678' are one ID.
    const id = raw.padStart(field.length, '0');
    if (SHARED_IDS.has(id)) {
      continue;
    }
    if (seen.has(id)) {
      issues.push(
        makeIssue('shareholders.duplicateId', {
          message: `Shareholder ID ${id} appears more than once.`,
          path: pathFor('1020', record.index, ID_NUMBER),
          recordType: '1020',
          recordIndex: record.index,
          field: { position: field.position, length: field.length, nameHe: field.nameHe },
          value: id,
        }),
      );
    }
    seen.add(id);
  }
  return issues;
}

/** The shareholder rules of SPEC §10.4. */
export const SHAREHOLDER_RULES: readonly ReportRule[] = [dividendRightsTotal, duplicateId];
