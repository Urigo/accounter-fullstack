import { validate1214 } from '@accounter/opcn1214-generator';
import type { Report1214Issue } from '../../../__generated__/types.js';
import type { Report1214BuildResult, Report1214IssueProto } from '../types.js';

/** A generator `Issue` or a mapping issue → GraphQL `Report1214Issue`. */
export function issueToGql(issue: Report1214IssueProto): Report1214Issue {
  return {
    ruleId: issue.ruleId,
    severity: issue.severity === 'error' ? 'ERROR' : 'WARNING',
    message: issue.message,
    path: issue.path || null,
    code: issue.code ?? null,
    recordType: issue.recordType ?? null,
    recordIndex: issue.recordIndex ?? null,
    specRef: issue.specRef
      ? `p.${issue.specRef.page}${issue.specRef.note ? `: ${issue.specRef.note}` : ''}`
      : null,
  };
}

/** The generator's rule for input that does not have the shape of `Report1214Input`. */
const INPUT_SHAPE_RULE = 'input.shape';

/**
 * The issues of a built report: the mapping issues, then `validate1214` of the input (skipped when
 * no input could be built).
 *
 * A required identity member the books lack is already a mapping error at its path (e.g.
 * `company.phone`); the generator's `input.shape` issue at the same path says the same thing less
 * helpfully, so it is dropped. While any `input.shape` issue remains the generator stops there, so
 * the form's other rules only run in full once the identity is complete.
 */
export function collectReport1214Issues({ input, mappingIssues }: Report1214BuildResult): {
  errors: Report1214IssueProto[];
  warnings: Report1214IssueProto[];
} {
  const result = input ? validate1214(input) : { errors: [], warnings: [] };
  const mappingErrorPaths = new Set(
    mappingIssues.filter(issue => issue.severity === 'error').map(issue => issue.path),
  );
  const notRepeated = (issue: Report1214IssueProto) =>
    !(issue.ruleId === INPUT_SHAPE_RULE && mappingErrorPaths.has(issue.path));
  return {
    errors: [
      ...mappingIssues.filter(issue => issue.severity === 'error'),
      ...result.errors.filter(notRepeated),
    ],
    warnings: [
      ...mappingIssues.filter(issue => issue.severity === 'warning'),
      ...result.warnings.filter(notRepeated),
    ],
  };
}
