/**
 * The validation pipeline (SPEC §9.2, IMPLEMENTATION_PLAN.md §1.2): year → shape → normalize →
 * rules. The single validation entry point of the public API.
 */
import { unsupportedTaxYearIssue } from './errors.js';
import { getLayout, supportedTaxYears } from './layout/registry.js';
import type { Report1214Input, SupportedTaxYear } from './model/input.js';
import type { NormalizedReport } from './model/normalized.js';
import type { ValidateOptions } from './model/options.js';
import { schemaFor } from './model/schema.js';
import { normalizeReport } from './normalize/report.js';
import { runRules } from './validate/engine.js';
import { compareIssues, type Issue } from './validate/issue.js';
import { zodIssuesToIssues } from './validate/shape.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validates `input`: stage 1 checks the tax year and stops on struct.taxYear.unsupported; stage 2
 * checks the shape with the year's strict schema and stops on input.shape; then the input is
 * normalized and every rule runs. `report` is set unless a stopping stage failed. Never throws for
 * bad input; issues are sorted (SPEC §9.1).
 */
export function runPipeline(
  input: unknown,
  options: ValidateOptions = {},
): { report?: NormalizedReport; issues: Issue[] } {
  const taxYear = isObject(input) ? input.taxYear : undefined;
  const supported = supportedTaxYears();
  if (typeof taxYear !== 'number' || !supported.includes(taxYear)) {
    return { issues: [unsupportedTaxYearIssue(taxYear, supported)] };
  }
  const shape = schemaFor(taxYear as SupportedTaxYear).safeParse(input, { reportInput: true });
  if (!shape.success) {
    return { issues: zodIssuesToIssues(shape.error).sort(compareIssues) };
  }
  // The schema is Report1214Input with plain strings where the types have literal unions (phone
  // prefixes); the field rules check those values.
  const report = normalizeReport(input as Report1214Input, getLayout(taxYear), options);
  return { report, issues: runRules(report) };
}
