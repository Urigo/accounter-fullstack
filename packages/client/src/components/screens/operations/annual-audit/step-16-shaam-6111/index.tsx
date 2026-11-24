import { useMemo, type ReactElement } from 'react';
import { useQuery } from 'urql';
import { AnnualAuditStep16Shaam6111ValidationDocument } from '../../../../../gql/graphql.js';
import { ROUTES } from '../../../../../router/routes.js';
import { type BaseStepProps } from '../step-base.js';
import { StepWithLink } from '../step-with-link.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AnnualAuditStep16Shaam6111Validation($year: Int!, $businessId: UUID) {
    shaam6111(year: $year, businessId: $businessId) {
      id
      validation {
        isValid
      }
    }
  }
`;

interface Step16Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

/** Done once the year's 6111 passes validation with no blocking errors, and is confirmed */
export function Step16Shaam6111({ adminBusinessId, year, ...props }: Step16Props): ReactElement {
  const href = useMemo(() => `${ROUTES.REPORTS.SHAAM_6111}?year=${year}`, [year]);
  const [{ data, fetching, error }] = useQuery({
    query: AnnualAuditStep16Shaam6111ValidationDocument,
    variables: { year, businessId: adminBusinessId },
    pause: !adminBusinessId,
  });
  const isValid = !!data?.shaam6111.validation.isValid;
  // until the check returns, keep the saved status (so the audit progress doesn't dip on every
  // load), but don't allow marking the step done
  const isKnown = !!data && !fetching;

  let notReadyMessage =
    'The 6111 report has blocking errors; fix them before marking this step done.';
  if (fetching) {
    notReadyMessage = 'Checking the 6111 report…';
  } else if (error) {
    notReadyMessage = `The 6111 report could not be computed: ${error.message}`;
  }

  return (
    <StepWithLink
      {...props}
      stepId="16"
      adminBusinessId={adminBusinessId}
      year={year}
      description="Generate the 6111 report; it must pass validation with no blocking errors"
      linkLabel="Open 6111 Report"
      linkHref={href}
      ready={!isKnown || isValid}
      canMarkDone={isKnown && isValid}
      notReadyMessage={notReadyMessage}
    />
  );
}
