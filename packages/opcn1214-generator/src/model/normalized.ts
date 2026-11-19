/**
 * The internal model between the public input and the file (IMPLEMENTATION_PLAN.md §1.2). The
 * normalizer and the parser produce it; codecs, rules and file assembly only see this model.
 */
import type { Primitive } from '../codec/types.js';
import type { RecordType, YearLayout } from '../layout/types.js';
import type { Issue } from '../validate/issue.js';

/** One record of a report, with its values in model units (value conventions: plan §1.2). */
export interface NormalizedRecord {
  recordType: RecordType;
  /** 0-based among records of the same type. */
  index: number;
  /** FieldDef.key → value (derived keys included). */
  values: Record<string, Primitive>;
  /** Code-amount section, natural units. */
  codes: Map<string, number>;
  /** Country-amount section: 2200 only, otherwise []. */
  countries: Array<{ country: string; income: number }>;
  /** key | `code:${code}` | `countries[${i}]` → input path. */
  paths: Record<string, string>;
}

/** One report: its records in canonical order (SPEC §3.3), 9999 excluded. */
export interface NormalizedReport {
  taxYear: number;
  layout: YearLayout;
  records: NormalizedRecord[];
  /** Raised while normalizing (e.g. phone prefix dropped). */
  notices: Issue[];
  omittedZeroCodes: Array<{ record: RecordType; recordIndex: number; code: string }>;
}
