import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useQuery } from 'urql';
import { AnnualAuditStepStatus, Step11StepStatusDocument } from '../../../../../gql/graphql.js';
import { useSetAnnualAuditStepStatus } from '../../../../../hooks/use-set-annual-audit-step-status.js';
import { ROUTES } from '../../../../../router/routes.js';
import { Button } from '../../../../ui/button.js';
import { BaseStepCard, type BaseStepProps, type StepStatus } from '../step-base.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query Step11StepStatus($ownerId: UUID!, $year: Int!) {
    annualAuditStepStatuses(ownerId: $ownerId, year: $year) {
      id
      stepId
      status
    }
  }
`;

interface Step11Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step11DepreciationReport(props: Step11Props) {
  const [status, setStatus] = useState<StepStatus>('pending');
  const { adminBusinessId, id, onStatusChange, year } = props;
  const { fetching: saving, setStepStatus } = useSetAnnualAuditStepStatus();

  const [{ data: statusData, fetching: fetchingStatus }, refetchStatus] = useQuery({
    query: Step11StepStatusDocument,
    variables: { ownerId: adminBusinessId!, year },
    pause: !adminBusinessId,
  });

  // Report status changes to parent
  useEffect(() => onStatusChange?.(id, status), [status, onStatusChange, id]);

  const step11Record = useMemo(
    () => statusData?.annualAuditStepStatuses.find(s => s.stepId === '11'),
    [statusData],
  );

  useEffect(() => {
    if (!adminBusinessId) {
      setStatus('blocked');
    } else if (fetchingStatus || saving) {
      setStatus('loading');
    } else if (step11Record?.status === AnnualAuditStepStatus.Completed) {
      setStatus('completed');
    } else {
      setStatus('pending');
    }
  }, [adminBusinessId, fetchingStatus, saving, step11Record]);

  const depreciationHref = useMemo(
    () =>
      ROUTES.REPORTS.DEPRECIATION(
        adminBusinessId ? { year, financialEntityId: adminBusinessId } : { year },
      ),
    [year, adminBusinessId],
  );

  const handleMarkDone = useCallback(async () => {
    if (!adminBusinessId) return;
    const result = await setStepStatus({
      input: {
        ownerId: adminBusinessId,
        year,
        stepId: '11',
        status: AnnualAuditStepStatus.Completed,
      },
    });
    if (result) refetchStatus();
  }, [adminBusinessId, year, setStepStatus, refetchStatus]);

  const handleUnmark = useCallback(async () => {
    if (!adminBusinessId) return;
    const result = await setStepStatus({
      input: {
        ownerId: adminBusinessId,
        year,
        stepId: '11',
        status: AnnualAuditStepStatus.Pending,
      },
    });
    if (result) refetchStatus();
  }, [adminBusinessId, year, setStepStatus, refetchStatus]);

  return (
    <BaseStepCard
      {...props}
      status={status}
      description="Review and export the final depreciation report for the year"
    >
      {adminBusinessId && !fetchingStatus && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <a href={depreciationHref} target="_blank" rel="noreferrer">
                <ExternalLink size={16} className="mr-1.5" />
                Open Depreciation Report
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
