/**
 * The validation pipeline (SPEC §9.2, IMPLEMENTATION_PLAN.md §1.2): year → normalize → rules.
 * The single validation entry point of the public API.
 */
import { unsupportedTaxYearIssue } from './errors.js';
import { getLayout, provisionalBaseYear, supportedTaxYears } from './layout/registry.js';
import type { Report1214Input } from './model/input.js';
import type { NormalizedReport } from './model/normalized.js';
import type { ValidateOptions } from './model/options.js';
import { normalizeReport } from './normalize/report.js';
import { runRules } from './validate/engine.js';
import { compareIssues, makeIssue, type Issue } from './validate/issue.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The struct.taxYear.provisionalLayout warning of `taxYear`, if its layout is provisional. */
function provisionalLayoutIssues(taxYear: number): Issue[] {
  const baseYear = provisionalBaseYear(taxYear);
  if (baseYear === undefined) {
    return [];
  }
  return [
    makeIssue('struct.taxYear.provisionalLayout', {
      message: `Tax year ${taxYear} has no SHAAM layout of its own yet: the report uses the ${baseYear} layout and is provisional (SPEC §14).`,
      path: 'taxYear',
      value: taxYear,
      expected: 'a tax year with its own layout',
    }),
  ];
}

/**
 * Validates `input`: stage 1 checks the tax year, stops on struct.taxYear.unsupported and warns
 * with struct.taxYear.provisionalLayout (without stopping); then the input is normalized and
 * every rule runs. `report` is set unless a stopping stage failed. Never throws for bad input;
 * issues are sorted (SPEC §9.1).
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
  // Until the shape stage (C5) exists, the rest of the input is assumed well-typed.
  const report = normalizeReport(input as unknown as Report1214Input, getLayout(taxYear), options);
  return {
    report,
    issues: [...provisionalLayoutIssues(taxYear), ...runRules(report)].sort(compareIssues),
  };
}
