import type { ReactElement } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SecuritiesSemiAnnualIssuesFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { ROUTES } from '../../../../router/routes.js';
import { SecuritiesTaxCategoryDialog } from '../../../charges/securities-tax-category-dialog.js';
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
      missingTaxCategory
    }
  }
`;

type Props = {
  data: FragmentType<typeof SecuritiesSemiAnnualIssuesFragmentDoc>;
  /**
   * Whether a missing securities tax category can be set from here: the settings saved are the
   * user's own business's, so only on its own report
   */
  canSetTaxCategories: boolean;
  /** Called once a missing tax category is set, to reload the report */
  onTaxCategorySet: () => void;
};

/** What the report could not work out, or may have missed — on screen only */
export function ReportIssues({
  data,
  canSetTaxCategories,
  onTaxCategorySet,
}: Props): ReactElement | null {
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
              {issue.missingTaxCategory && canSetTaxCategories && (
                <span className="ms-2 inline-block align-middle">
                  <SecuritiesTaxCategoryDialog
                    taxCategoryKey={issue.missingTaxCategory}
                    onDone={onTaxCategorySet}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
