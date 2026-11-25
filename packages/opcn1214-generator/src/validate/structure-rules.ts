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
