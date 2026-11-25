import { useMemo } from 'react';
import { ROUTES } from '../../../../../router/routes.js';
import { type BaseStepProps } from '../step-base.js';
import { StepWithLink } from '../step-with-link.js';

interface Step18Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step18Form1214({ adminBusinessId, year, ...props }: Step18Props) {
  const form1214Href = useMemo(() => ROUTES.REPORTS.FORM_1214(year), [year]);

  return (
    <StepWithLink
      {...props}
      stepId="18"
      adminBusinessId={adminBusinessId}
      year={year}
      description="Fix the validation issues and download the 1214 file for SHAAM"
      linkLabel="Open 1214 Report"
      linkHref={form1214Href}
    />
  );
}
