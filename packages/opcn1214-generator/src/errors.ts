import type { Issue } from './validate/issue.js';

/** Issues named in an error message (SPEC §11.2). */
const SUMMARIZED_ISSUES = 5;

function summarize(message: string, issues: readonly Issue[]): string {
  if (issues.length === 0) {
    return message;
  }
  const listed = issues
    .slice(0, SUMMARIZED_ISSUES)
    .map(issue => (issue.path ? `${issue.ruleId} at ${issue.path}` : issue.ruleId));
  const rest = issues.length - listed.length;
  if (rest > 0) {
    listed.push(`… and ${rest} more`);
  }
  return `${message}: ${listed.join('; ')}`;
}

/** Base class of the package's data errors; carries every issue found (SPEC §11.2). */
export class Opcn1214Error extends Error {
  readonly issues: readonly Issue[];

  /** `message` is a heading; the first five issues are appended to it. */
  constructor(message: string, issues: readonly Issue[], options?: ErrorOptions) {
    super(summarize(message, issues), options);
    this.name = 'Opcn1214Error';
    this.issues = issues;
  }
}

/** `taxYear` for a message; never throws, whatever the value. */
function showTaxYear(taxYear: unknown): string {
  switch (typeof taxYear) {
    case 'string':
      return JSON.stringify(taxYear);
    case 'object':
      return taxYear === null ? 'null' : 'an object';
    case 'function':
      return 'a function';
    case 'symbol':
      return 'a symbol';
    default:
      return String(taxYear);
  }
}

/** The struct.taxYear.unsupported issue of `taxYear` (SPEC §10.1); `taxYear` may be any value. */
export function unsupportedTaxYearIssue(
  taxYear: unknown,
  supportedYears: readonly number[],
): Issue {
  const supported = supportedYears.join(', ');
  return {
    ruleId: 'struct.taxYear.unsupported',
    severity: 'error',
    message: `Tax year ${showTaxYear(taxYear)} is not supported (supported: ${supported}).`,
    path: 'taxYear',
    value: taxYear,
    expected: `one of ${supported}`,
  };
}

/** Thrown by `getLayout` for a tax year without a layout. */
export class Opcn1214UnsupportedYearError extends Opcn1214Error {
  readonly taxYear: number;

  constructor(taxYear: number, supportedYears: readonly number[], options?: ErrorOptions) {
    super(
      `Unsupported tax year ${taxYear}`,
      [unsupportedTaxYearIssue(taxYear, supportedYears)],
      options,
    );
    this.name = 'Opcn1214UnsupportedYearError';
    this.taxYear = taxYear;
  }
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * Thrown by `generate1214` for a report with errors (SPEC §11.1): carries every error and
 * warning, errors first.
 */
export class Opcn1214ValidationError extends Opcn1214Error {
  constructor(issues: readonly Issue[], options?: ErrorOptions) {
    const errors = issues.filter(issue => issue.severity === 'error').length;
    const warnings = issues.length - errors;
    const heading = `1214 report has ${count(errors, 'error')}`;
    super(warnings > 0 ? `${heading} and ${count(warnings, 'warning')}` : heading, issues, options);
    this.name = 'Opcn1214ValidationError';
  }
}

/**
 * Thrown by `parse1214` for a file with structural problems (SPEC §8.2 steps 1–6): carries every
 * problem found, sorted by line and column, each with its line and column.
 */
export class Opcn1214ParseError extends Opcn1214Error {
  constructor(issues: readonly Issue[], options?: ErrorOptions) {
    super(`1214 file has ${count(issues.length, 'structural problem')}`, issues, options);
    this.name = 'Opcn1214ParseError';
  }
}

/** An invariant of the package was violated: a bug, never expected in production. */
export class Opcn1214InternalError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'Opcn1214InternalError';
  }
}
