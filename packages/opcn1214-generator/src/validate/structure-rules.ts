/** Structure rules (SPEC §9.2 stage 5, §10.1). */
import type { NormalizedReport } from '../model/normalized.js';
import { makeIssue, type Issue } from './issue.js';

/**
 * struct.mainCodePairs.max: record 1000 holds more code-amount pairs than its section allows (61,
 * p.13), counted after derivations.
 */
export function mainCodePairsMax(report: NormalizedReport): Issue[] {
  const max = report.layout.limits.mainCodePairs;
  return report.records
    .filter(record => record.recordType === '1000' && record.codes.size > max)
    .map(record =>
      makeIssue('struct.mainCodePairs.max', {
        message: `Record 1000 has ${record.codes.size} code-amount pairs (derived codes included); at most ${max} are allowed.`,
        path: 'amounts',
        recordType: '1000',
        recordIndex: record.index,
        value: record.codes.size,
        expected: `at most ${max}`,
        specRef: { page: 13 },
      }),
    );
}

/** Most shareholders (1020 records) in a report (p.2, p.21). */
const MAX_SHAREHOLDERS = 99;

function shareholderCount(report: NormalizedReport): number {
  return report.records.filter(record => record.recordType === '1020').length;
}

/**
 * struct.shareholders.min: no shareholders while the company is not a kibbutz (p.1, p.21); a
 * kibbutz may report none.
 */
export function shareholdersMin(report: NormalizedReport): Issue[] {
  const isKibbutz = report.records.some(
    record => record.recordType === '1000' && record.values['declarations.isKibbutz'] === true,
  );
  if (isKibbutz || shareholderCount(report) > 0) {
    return [];
  }
  return [
    makeIssue('struct.shareholders.min', {
      message:
        'The report has no shareholders; only a kibbutz (declarations.isKibbutz) may have none.',
      path: 'shareholders',
      recordType: '1020',
      value: 0,
      expected: 'at least 1',
      specRef: { page: 21 },
    }),
  ];
}

/** struct.shareholders.max: more than 99 shareholders (p.2, p.21). */
export function shareholdersMax(report: NormalizedReport): Issue[] {
  const count = shareholderCount(report);
  if (count <= MAX_SHAREHOLDERS) {
    return [];
  }
  return [
    makeIssue('struct.shareholders.max', {
      message: `The report has ${count} shareholders; at most ${MAX_SHAREHOLDERS} are allowed.`,
      path: 'shareholders',
      recordType: '1020',
      value: count,
      expected: `at most ${MAX_SHAREHOLDERS}`,
      specRef: { page: 21 },
    }),
  ];
}
