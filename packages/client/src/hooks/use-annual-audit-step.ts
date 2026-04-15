import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'urql';
import { AnnualAuditStepStatus, AnnualAuditStepStatusDocument } from '../gql/graphql.js';
import { useSetAnnualAuditStepStatus } from './use-set-annual-audit-step-status.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AnnualAuditStepStatus($ownerId: UUID!, $year: Int!) {
    annualAuditStepStatuses(ownerId: $ownerId, year: $year) {
      id
      stepId
      status
    }
  }
`;

export type AuditStepStatus = 'completed' | 'in-progress' | 'pending' | 'blocked' | 'loading';

interface UseAnnualAuditStepOptions {
  stepId: string;
  adminBusinessId?: string;
  year: number;
}

interface UseAnnualAuditStepResult {
  status: AuditStepStatus;
  saving: boolean;
  fetchingStatus: boolean;
  handleMarkDone: () => Promise<void>;
  handleUnmark: () => Promise<void>;
}

export function useAnnualAuditStep({
  stepId,
  adminBusinessId,
  year,
}: UseAnnualAuditStepOptions): UseAnnualAuditStepResult {
  const [status, setStatus] = useState<AuditStepStatus>('pending');
  const { fetching: saving, setStepStatus } = useSetAnnualAuditStepStatus();

  const [{ data: statusData, fetching: fetchingStatus }, refetchStatus] = useQuery({
    query: AnnualAuditStepStatusDocument,
    variables: { ownerId: adminBusinessId!, year },
    pause: !adminBusinessId,
  });

  const stepRecord = useMemo(
    () => statusData?.annualAuditStepStatuses.find(s => s.stepId === stepId),
    [statusData, stepId],
  );

  useEffect(() => {
    if (!adminBusinessId) {
      setStatus('blocked');
    } else if (fetchingStatus || saving) {
      setStatus('loading');
    } else if (stepRecord?.status === AnnualAuditStepStatus.Completed) {
      setStatus('completed');
    } else {
      setStatus('pending');
    }
  }, [adminBusinessId, fetchingStatus, saving, stepRecord]);

  const handleMarkDone = useCallback(async () => {
    if (!adminBusinessId) return;
    const result = await setStepStatus({
      input: {
        ownerId: adminBusinessId,
        year,
        stepId,
        status: AnnualAuditStepStatus.Completed,
      },
    });
    if (result) refetchStatus();
  }, [adminBusinessId, year, stepId, setStepStatus, refetchStatus]);

  const handleUnmark = useCallback(async () => {
    if (!adminBusinessId) return;
    const result = await setStepStatus({
      input: {
        ownerId: adminBusinessId,
        year,
        stepId,
        status: AnnualAuditStepStatus.Pending,
      },
    });
    if (result) refetchStatus();
  }, [adminBusinessId, year, stepId, setStepStatus, refetchStatus]);

  return { status, saving, fetchingStatus, handleMarkDone, handleUnmark };
}
