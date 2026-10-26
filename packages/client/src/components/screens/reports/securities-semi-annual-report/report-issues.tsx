import type { ReactElement } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SecuritiesSemiAnnualIssuesFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { ROUTES } from '../../../../router/routes.js';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/alert.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SecuritiesSemiAnnualIssues on SecuritiesSemiAnnualReport {
    id
    issues {
      id
      message
      executionId
      chargeId
    }
  }
`;

type Props = {
  data: FragmentType<typeof SecuritiesSemiAnnualIssuesFragmentDoc>;
};

/** What the report could not work out, or may have missed — on screen only */
export function ReportIssues({ data }: Props): ReactElement | null {
  const { issues } = getFragmentData(SecuritiesSemiAnnualIssuesFragmentDoc, data);
  if (issues.length === 0) {
    return null;
  }

  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-900 print:hidden">
      <TriangleAlert className="size-4" />
      <AlertTitle>
        {issues.length === 1 ? '1 item needs a look' : `${issues.length} items need a look`} before
        filing
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          {issues.map(issue => (
            <li key={issue.id}>
              {issue.message}
              {issue.chargeId && (
                <>
                  {' '}
                  <Link
                    to={ROUTES.CHARGES.DETAIL(issue.chargeId)}
                    className="font-medium underline underline-offset-2"
                  >
                    Open charge
                  </Link>
                </>
              )}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
