import type { ReactElement } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import {
  Form1214ValidationPanelFragmentDoc,
  Report1214IssueSeverity,
  type Form1214ValidationPanelFragment,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/alert.js';
import { Badge } from '../../../ui/badge.js';
import { groupForm1214IssuesByPath } from './issues.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Form1214ValidationPanel on Report1214Validation {
    isValid
    errors {
      ruleId
      severity
      message
      path
      specRef
    }
    warnings {
      ruleId
      severity
      message
      path
      specRef
    }
  }
`;

type Issue = Form1214ValidationPanelFragment['errors'][number];

type Props = {
  validation: FragmentType<typeof Form1214ValidationPanelFragmentDoc>;
};

/**
 * The form 1214 issues: errors block the file, warnings should be reviewed before filing. Issues
 * are grouped by the report input path they are about, linked to the page section to fix them in.
 */
export function Form1214ValidationPanel({ validation }: Props): ReactElement {
  const { isValid, errors, warnings } = getFragmentData(
    Form1214ValidationPanelFragmentDoc,
    validation,
  );

  if (errors.length === 0 && warnings.length === 0) {
    return (
      <Alert className="border-green-300 bg-green-50 text-green-800">
        <CheckCircle2 className="h-4 w-4 text-green-700!" />
        <AlertTitle>The report passes the form 1214 checks</AlertTitle>
        <AlertDescription>The file is ready to download.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>
            {errors.length} blocking {errors.length === 1 ? 'issue' : 'issues'}: fix{' '}
            {errors.length === 1 ? 'it' : 'them'} to download the file
          </AlertTitle>
          <AlertDescription>
            <IssueGroups issues={errors} />
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
            <IssueGroups issues={warnings} />
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

function IssueGroups({ issues }: { issues: Issue[] }): ReactElement {
  return (
    <div className="mt-2 w-full space-y-3">
      {groupForm1214IssuesByPath(issues).map(group => (
        <div key={group.title}>
          <p className="font-mono text-xs font-semibold">
            {group.section ? (
              <a href={`#${group.section}`} className="underline underline-offset-2">
                {group.title}
              </a>
            ) : (
              group.title
            )}
          </p>
          <ul className="mt-1 space-y-1 pl-4">
            {group.issues.map((issue, index) => (
              <li key={`${issue.ruleId}-${index}`} className="flex flex-wrap items-baseline gap-2">
                <Badge
                  variant={
                    issue.severity === Report1214IssueSeverity.Error ? 'destructive' : 'outline'
                  }
                >
                  {issue.severity === Report1214IssueSeverity.Error ? 'Error' : 'Warning'}
                </Badge>
                <code className="text-xs opacity-80">{issue.ruleId}</code>
                <span dir="auto">{issue.message}</span>
                {issue.specRef && (
                  <span className="text-xs opacity-70">(spec: {issue.specRef})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
