import type { RecordType } from '../layout/types.js';

/** Issue severity (SPEC §9.1). */
export type Severity = 'error' | 'warning';

/** One validation or parse finding (SPEC §9.1). */
export interface Issue {
  /** Stable rule ID, e.g. 'main.familyCompany.code080' (SPEC §10). */
  ruleId: string;
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
