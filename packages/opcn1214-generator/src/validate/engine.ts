/** Rule engine (SPEC §9.2 stages 3–5): runs every rule over a NormalizedReport. */
import type { NormalizedReport } from '../model/normalized.js';
import { fieldRules } from './field-rules.js';
import { compareIssues, type Issue } from './issue.js';

type ReportRule = (report: NormalizedReport) => Issue[];

/** Stage 4: business rules (main.*, shareholders.*, foreign.*, cg.*). None yet. */
const BUSINESS_RULES: readonly ReportRule[] = [];
/** Stage 5: structure rules (struct.*). None yet. */
const STRUCTURE_RULES: readonly ReportRule[] = [];

/** All issues of `report`: normalizer notices and stages 3–5 (no fail-fast), sorted (SPEC §9.1). */
export function runRules(report: NormalizedReport): Issue[] {
  return [
    ...report.notices,
    ...fieldRules(report),
    ...BUSINESS_RULES.flatMap(rule => rule(report)),
    ...STRUCTURE_RULES.flatMap(rule => rule(report)),
  ].sort(compareIssues);
}
