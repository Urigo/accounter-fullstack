import { useMemo } from 'react';
import { ROUTES } from '../../../../../router/routes.js';
import { type BaseStepProps } from '../step-base.js';
import { StepWithLink } from '../step-with-link.js';

interface Step14Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step14TaxComplianceReport({ adminBusinessId, year, ...props }: Step14Props) {
  const complianceReportHref = useMemo(
    () => ROUTES.REPORTS.CORPORATE_TAX_RULING_COMPLIANCE(year),
    [year],
  );

  return (
    <StepWithLink
      {...props}
      stepId="14"
      adminBusinessId={adminBusinessId}
      year={year}
      description="For Yossi's review"
      linkLabel="Open Tax Compliance Report"
      linkHref={complianceReportHref}
    />
  );
}
