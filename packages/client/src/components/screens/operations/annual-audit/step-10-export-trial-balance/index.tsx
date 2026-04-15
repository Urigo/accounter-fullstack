import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useQuery } from 'urql';
import { AnnualAuditStepStatus, Step10StepStatusDocument } from '../../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../../helpers/dates.js';
import { useSetAnnualAuditStepStatus } from '../../../../../hooks/use-set-annual-audit-step-status.js';
import { ROUTES } from '../../../../../router/routes.js';
import { Button } from '../../../../ui/button.js';
import { BaseStepCard, type BaseStepProps, type StepStatus } from '../step-base.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query Step10StepStatus($ownerId: UUID!, $year: Int!) {
    annualAuditStepStatuses(ownerId: $ownerId, year: $year) {
      id
      stepId
      status
    }
  }
`;

interface Step10Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step10ExportTrialBalance(props: Step10Props) {
  const [status, setStatus] = useState<StepStatus>('pending');
  const { adminBusinessId, id, onStatusChange, year } = props;
  const { fetching: saving, setStepStatus } = useSetAnnualAuditStepStatus();

  const fromDate = `${year}-01-01` as TimelessDateString;
  const toDate = `${year}-12-31` as TimelessDateString;

  const [{ data: statusData, fetching: fetchingStatus }, refetchStatus] = useQuery({
    query: Step10StepStatusDocument,
    variables: { ownerId: adminBusinessId!, year },
    pause: !adminBusinessId,
  });

  // Report status changes to parent
  useEffect(() => onStatusChange?.(id, status), [status, onStatusChange, id]);

  const step10Record = useMemo(
    () => statusData?.annualAuditStepStatuses.find(s => s.stepId === '10'),
    [statusData],
  );

  useEffect(() => {
    if (!adminBusinessId) {
      setStatus('blocked');
    } else if (fetchingStatus || saving) {
      setStatus('loading');
    } else if (step10Record?.status === AnnualAuditStepStatus.Completed) {
      setStatus('completed');
    } else {
      setStatus('pending');
    }
  }, [adminBusinessId, fetchingStatus, saving, step10Record]);

  const trialBalanceHref = useMemo(
    () =>
      ROUTES.REPORTS.TRIAL_BALANCE({
        fromDate,
        toDate,
        ownerIds: adminBusinessId ? [adminBusinessId] : undefined,
      }),
    [fromDate, toDate, adminBusinessId],
  );

  const handleMarkDone = useCallback(async () => {
    if (!adminBusinessId) return;
    const result = await setStepStatus({
      input: {
        ownerId: adminBusinessId,
        year,
        stepId: '10',
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
        stepId: '10',
        status: AnnualAuditStepStatus.Pending,
      },
    });
    if (result) refetchStatus();
  }, [adminBusinessId, year, setStepStatus, refetchStatus]);

  return (
    <BaseStepCard
      {...props}
      status={status}
      description="Download year-end trial balance CSV for future validations"
    >
      {adminBusinessId && !fetchingStatus && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <a href={trialBalanceHref} target="_blank" rel="noreferrer">
                <ExternalLink size={16} className="mr-1.5" />
                Open Trial Balance Report
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
