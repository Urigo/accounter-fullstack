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

/** Thrown by `getLayout` for a tax year without a layout. */
export class Opcn1214UnsupportedYearError extends Opcn1214Error {
  readonly taxYear: number;

  constructor(taxYear: number, supportedYears: readonly number[], options?: ErrorOptions) {
    const supported = supportedYears.join(', ');
    super(
      `Unsupported tax year ${taxYear}`,
      [
        {
          ruleId: 'struct.taxYear.unsupported',
          severity: 'error',
          message: `Tax year ${taxYear} is not supported (supported: ${supported}).`,
          path: 'taxYear',
          value: taxYear,
          expected: `one of ${supported}`,
        },
      ],
      options,
    );
    this.name = 'Opcn1214UnsupportedYearError';
    this.taxYear = taxYear;
  }
}

/** An invariant of the package was violated: a bug, never expected in production. */
export class Opcn1214InternalError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'Opcn1214InternalError';
  }
}
