import { useMemo } from 'react';
import { ROUTES } from '../../../../../router/routes.js';
import { type BaseStepProps } from '../step-base.js';
import { StepWithLink } from '../step-with-link.js';

interface Step11Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step11DepreciationReport({ adminBusinessId, year, ...props }: Step11Props) {
  const depreciationHref = useMemo(
    () =>
      ROUTES.REPORTS.DEPRECIATION(
        adminBusinessId ? { year, financialEntityId: adminBusinessId } : { year },
      ),
    [year, adminBusinessId],
  );

  return (
    <StepWithLink
      {...props}
      stepId="11"
      adminBusinessId={adminBusinessId}
      year={year}
      description="Review and export the final depreciation report for the year"
      linkLabel="Open Depreciation Report"
      linkHref={depreciationHref}
    />
  );
}
