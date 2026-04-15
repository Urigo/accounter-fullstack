import { useMemo } from 'react';
import { ROUTES } from '../../../../../router/routes.js';
import { type BaseStepProps } from '../step-base.js';
import { StepWithLink } from '../step-with-link.js';

interface Step13Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step13TaxReport({ adminBusinessId, year, ...props }: Step13Props) {
  const taxReportHref = useMemo(() => ROUTES.REPORTS.TAX(year), [year]);

  return (
    <StepWithLink
      {...props}
      stepId="13"
      adminBusinessId={adminBusinessId}
      year={year}
      description="Review and export the tax report for the year"
      linkLabel="Open Tax Report"
      linkHref={taxReportHref}
    />
  );
}
