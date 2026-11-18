import type { ReactElement } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import {
  Shaam6111ValidationIssuesFragmentDoc,
  Shaam6111ValidationSeverity,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/alert.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Shaam6111ValidationIssues on Shaam6111Validation {
    isValid
    issues {
      severity
      message
      path
    }
  }
`;

type Props = {
  validation: FragmentType<typeof Shaam6111ValidationIssuesFragmentDoc>;
};

/**
 * The checks SHAAM runs on the file (blocking errors) and data-quality diagnostics (warnings),
 * such as ledger balances that never reach the report because their entity has no IRS code.
 */
export function Shaam6111ValidationIssues({ validation }: Props): ReactElement {
  const { isValid, issues } = getFragmentData(Shaam6111ValidationIssuesFragmentDoc, validation);
  const errors = issues.filter(issue => issue.severity === Shaam6111ValidationSeverity.Error);
  const warnings = issues.filter(issue => issue.severity === Shaam6111ValidationSeverity.Warning);

  if (issues.length === 0) {
    return (
      <Alert className="mb-4 border-green-300 bg-green-50 text-green-800" dir="ltr">
        <CheckCircle2 className="h-4 w-4 text-green-700!" />
        <AlertTitle>The report passes the SHAAM 6111 checks</AlertTitle>
        <AlertDescription>The file is ready to download.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mb-4 space-y-3" dir="ltr">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>
            {errors.length} blocking {errors.length === 1 ? 'issue' : 'issues'}: SHAAM would reject
            this file
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {errors.map((issue, index) => (
                <li key={`error-${index}`}>
                  {issue.message}
                  {issue.path && issue.path !== 'custom' && (
                    <span className="ml-1 text-xs opacity-70">({issue.path})</span>
                  )}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-700!" />
          <AlertTitle>
            {warnings.length} {warnings.length === 1 ? 'item' : 'items'} to review before filing
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {warnings.map((issue, index) => (
                <li key={`warning-${index}`}>{issue.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {isValid && (
        <p className="text-sm text-muted-foreground">
          No blocking issues: the file can be downloaded.
        </p>
      )}
    </div>
  );
}
