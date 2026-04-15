import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useQuery } from 'urql';
import { AnnualAuditStepStatus, Step13StepStatusDocument } from '../../../../../gql/graphql.js';
import { useSetAnnualAuditStepStatus } from '../../../../../hooks/use-set-annual-audit-step-status.js';
import { ROUTES } from '../../../../../router/routes.js';
import { Button } from '../../../../ui/button.js';
import { BaseStepCard, type BaseStepProps, type StepStatus } from '../step-base.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query Step13StepStatus($ownerId: UUID!, $year: Int!) {
    annualAuditStepStatuses(ownerId: $ownerId, year: $year) {
      id
      stepId
      status
    }
  }
`;

interface Step13Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step13TaxReport(props: Step13Props) {
  const [status, setStatus] = useState<StepStatus>('pending');
  const { adminBusinessId, id, onStatusChange, year } = props;
  const { fetching: saving, setStepStatus } = useSetAnnualAuditStepStatus();

  const [{ data: statusData, fetching: fetchingStatus }, refetchStatus] = useQuery({
    query: Step13StepStatusDocument,
    variables: { ownerId: adminBusinessId!, year },
    pause: !adminBusinessId,
  });

  useEffect(() => onStatusChange?.(id, status), [status, onStatusChange, id]);

  const step13Record = useMemo(
    () => statusData?.annualAuditStepStatuses.find(s => s.stepId === '13'),
    [statusData],
  );

  useEffect(() => {
    if (!adminBusinessId) {
      setStatus('blocked');
    } else if (fetchingStatus || saving) {
      setStatus('loading');
    } else if (step13Record?.status === AnnualAuditStepStatus.Completed) {
      setStatus('completed');
    } else {
      setStatus('pending');
    }
  }, [adminBusinessId, fetchingStatus, saving, step13Record]);

  const taxReportHref = useMemo(() => ROUTES.REPORTS.TAX(year), [year]);

  const handleMarkDone = useCallback(async () => {
    if (!adminBusinessId) return;
    const result = await setStepStatus({
      input: {
        ownerId: adminBusinessId,
        year,
        stepId: '13',
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
        stepId: '13',
        status: AnnualAuditStepStatus.Pending,
      },
    });
    if (result) refetchStatus();
  }, [adminBusinessId, year, setStepStatus, refetchStatus]);

  return (
    <BaseStepCard
      {...props}
      status={status}
      description="Review and export the tax report for the year"
    >
      {adminBusinessId && !fetchingStatus && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <a href={taxReportHref} target="_blank" rel="noreferrer">
                <ExternalLink size={16} className="mr-1.5" />
                Open Tax Report
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
