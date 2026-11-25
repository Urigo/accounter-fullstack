/** validate1214 (SPEC §6.1): validation without generation. */
import type { ValidateOptions } from '../model/options.js';
import { runPipeline } from '../pipeline.js';
import type { Issue } from '../validate/issue.js';

/** The outcome of validate1214 (SPEC §6.2). */
export interface ValidationResult {
  /** True exactly when `errors` is empty. */
  valid: boolean;
  /** Severity 'error', sorted (SPEC §9.1). */
  errors: Issue[];
  /** Severity 'warning', sorted (SPEC §9.1). */
  warnings: Issue[];
}

/** `issues` (already sorted) split by severity; the order is kept within each part. */
export function splitIssues(issues: readonly Issue[]): ValidationResult {
  const errors = issues.filter(issue => issue.severity === 'error');
  const warnings = issues.filter(issue => issue.severity === 'warning');
  return { valid: errors.length === 0, errors, warnings };
}

/** Validates without generating. Never throws for bad input; returns every issue found. */
export function validate1214(input: unknown, options?: ValidateOptions): ValidationResult {
  return splitIssues(runPipeline(input, options).issues);
}
