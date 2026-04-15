import { useMemo } from 'react';
import type { TimelessDateString } from '../../../../../helpers/dates.js';
import { ROUTES } from '../../../../../router/routes.js';
import { type BaseStepProps } from '../step-base.js';
import { StepWithLink } from '../step-with-link.js';

interface Step10Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step10ExportTrialBalance({ adminBusinessId, year, ...props }: Step10Props) {
  const fromDate = `${year}-01-01` as TimelessDateString;
  const toDate = `${year}-12-31` as TimelessDateString;

  const trialBalanceHref = useMemo(
    () =>
      ROUTES.REPORTS.TRIAL_BALANCE({
        fromDate,
        toDate,
        ownerIds: adminBusinessId ? [adminBusinessId] : undefined,
      }),
    [fromDate, toDate, adminBusinessId],
  );

  return (
    <StepWithLink
      {...props}
      stepId="10"
      adminBusinessId={adminBusinessId}
      year={year}
      description="Download year-end trial balance CSV for future validations"
      linkLabel="Open Trial Balance Report"
      linkHref={trialBalanceHref}
    />
  );
}
