import type { RecordType } from '../layout/types.js';
import { ruleMeta, type RuleId } from './rules.js';

/** Issue severity (SPEC §9.1). */
export type Severity = 'error' | 'warning';

/** One validation or parse finding (SPEC §9.1). */
export interface Issue {
  /** Stable rule ID, e.g. 'main.familyCompany.code080' (SPEC §10). */
  ruleId: RuleId;
  severity: Severity;
  /** English, human-readable, may include values. */
  message: string;
  /** Input path (SPEC §9.1 path grammar); '' for report-level issues. */
  path: string;
  recordType?: RecordType;
  /** 0-based index among records of that type. */
  recordIndex?: number;
  /** Batch only. */
  reportIndex?: number;
  /** For field-level issues. */
  field?: { position: number; length: number; nameHe: string };
  /** For code-amount issues. */
  code?: string;
  /** Offending value (redacted to 100 chars). */
  value?: unknown;
  /** E.g. 'one of 1, 2, 12'. */
  expected?: string;
  specRef?: { page: number; note?: string };
  /** Parse issues: 1-based line. */
  line?: number;
  /** Parse issues: 1-based column. */
  column?: number;
}

/** Longest string `value` an issue carries (SPEC §9.1). */
const MAX_VALUE_LENGTH = 100;

/** An issue of `ruleId` with its catalogued severity; long string values are redacted. */
export function makeIssue(ruleId: RuleId, details: Omit<Issue, 'ruleId' | 'severity'>): Issue {
  const issue: Issue = { ruleId, severity: ruleMeta(ruleId).severity, ...details };
  if (typeof issue.value === 'string' && issue.value.length > MAX_VALUE_LENGTH) {
    issue.value = `${issue.value.slice(0, MAX_VALUE_LENGTH - 1)}…`;
  }
  return issue;
}

/** Record order within a report (SPEC §3.3). */
const RECORD_ORDER: Readonly<Record<RecordType, number>> = {
  '1000': 1,
  '1010': 2,
  '1020': 3,
  '1030': 4,
  '2000': 5,
  '2200': 6,
  '3027': 7,
  '3050': 8,
  '3051': 9,
  '3054': 10,
  '3060': 11,
  '3063': 12,
  '3064': 13,
  '3065': 14,
  '3066': 15,
  '3077': 16,
  '9999': 17,
};

/** True for one of the record types of SPEC §3.2. */
export function isRecordType(value: string): value is RecordType {
  return Object.hasOwn(RECORD_ORDER, value);
}

/** Rank of a record type in the record order of a report (SPEC §3.3); 1000 is 1, 9999 last. */
export function recordRank(type: RecordType): number {
  return RECORD_ORDER[type];
}

function compareNumbers(a: number | undefined, b: number | undefined): number {
  return (a ?? -1) - (b ?? -1);
}

function compareStrings(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/** Within a record: record-level issues, then header fields by position, then codes by code. */
function compareLocation(a: Issue, b: Issue): number {
  const rank = (issue: Issue): number => {
    if (issue.field) {
      return 1;
    }
    return issue.code === undefined ? 0 : 2;
  };
  return (
    rank(a) - rank(b) ||
    compareNumbers(a.field?.position, b.field?.position) ||
    compareStrings(a.code ?? '', b.code ?? '')
  );
}

/**
 * Deterministic issue order (SPEC §9.1): report index → record order (SPEC §3.3) → record index →
 * field position or code → rule ID. Issues without a report index, record type or record index
 * come first at their level.
 */
export function compareIssues(a: Issue, b: Issue): number {
  return (
    compareNumbers(a.reportIndex, b.reportIndex) ||
    compareNumbers(
      a.recordType && RECORD_ORDER[a.recordType],
      b.recordType && RECORD_ORDER[b.recordType],
    ) ||
    compareNumbers(a.recordIndex, b.recordIndex) ||
    compareLocation(a, b) ||
    compareStrings(a.ruleId, b.ruleId)
  );
}
