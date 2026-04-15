import { useEffect, type ReactElement } from 'react';
import { ExternalLink } from 'lucide-react';
import { useAnnualAuditStep } from '../../../../hooks/use-annual-audit-step.js';
import { Button } from '../../../ui/button.js';
import { BaseStepCard, type BaseStepProps } from './step-base.js';

interface StepWithLinkProps extends BaseStepProps {
  stepId: string;
  adminBusinessId?: string;
  year: number;
  linkLabel: string;
  linkHref: string;
}

export function StepWithLink({
  stepId,
  adminBusinessId,
  year,
  linkLabel,
  linkHref,
  ...props
}: StepWithLinkProps): ReactElement {
  const { status, saving, fetchingStatus, handleMarkDone, handleUnmark } = useAnnualAuditStep({
    stepId,
    adminBusinessId,
    year,
  });

  const { onStatusChange, id } = props;
  useEffect(() => onStatusChange?.(id, status), [status, onStatusChange, id]);

  return (
    <BaseStepCard {...props} status={status}>
      {adminBusinessId && !fetchingStatus && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <a href={linkHref} target="_blank" rel="noreferrer">
                <ExternalLink size={16} className="mr-1.5" />
                {linkLabel}
              </a>
            </Button>
            {status === 'completed' ? (
              <Button variant="ghost" size="sm" disabled={saving} onClick={handleUnmark}>
                Unmark
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={saving} onClick={handleMarkDone}>
                Mark as Done
              </Button>
            )}
          </div>
        </div>
      )}
    </BaseStepCard>
  );
}
