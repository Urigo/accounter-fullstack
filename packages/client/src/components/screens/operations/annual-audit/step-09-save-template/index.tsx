import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'urql';
import { useSetAnnualAuditStep09Status } from '@/hooks/use-set-annual-audit-step09-status.js';
import {
  AllContoReportsDocument,
  AnnualAuditStepStatus,
  Step09SaveTemplateStatusDocument,
} from '../../../../../gql/graphql.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select.js';
import { BaseStepCard, type BaseStepProps, type StepStatus } from '../step-base.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query Step09SaveTemplateStatus($ownerId: UUID!, $year: Int!) {
    annualAuditStepStatuses(ownerId: $ownerId, year: $year) {
      id
      stepId
      status
      evidence
    }
  }
`;

interface Step09Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step09SaveTemplate(props: Step09Props) {
  const [status, setStatus] = useState<StepStatus>('pending');
  const { adminBusinessId, id, onStatusChange, year } = props;
  const { fetching: saving, setStep09Status } = useSetAnnualAuditStep09Status();

  const [{ data: statusData, fetching: fetchingStatus }, refetchStatus] = useQuery({
    query: Step09SaveTemplateStatusDocument,
    variables: { ownerId: adminBusinessId!, year },
    pause: !adminBusinessId,
  });

  const [{ data: templatesData, fetching: fetchingTemplates }] = useQuery({
    query: AllContoReportsDocument,
  });

  // Report status changes to parent
  useEffect(() => onStatusChange?.(id, status), [status, onStatusChange, id]);

  // Derive step 9 evidence from fetched step statuses
  const step09Record = useMemo(
    () => statusData?.annualAuditStepStatuses.find(s => s.stepId === id),
    [statusData, id],
  );

  const lockedTemplateName = useMemo<string | null>(() => {
    if (!step09Record?.evidence) return null;
    try {
      const parsed = JSON.parse(step09Record.evidence) as { lockedTemplateName?: string };
      return parsed.lockedTemplateName ?? null;
    } catch {
      return null;
    }
  }, [step09Record]);

  // Update status badge
  useEffect(() => {
    if (!adminBusinessId) {
      setStatus('blocked');
    } else if (fetchingStatus || fetchingTemplates || saving) {
      setStatus('loading');
    } else if (step09Record?.status === AnnualAuditStepStatus.Completed && lockedTemplateName) {
      setStatus('completed');
    } else {
      setStatus('pending');
    }
  }, [
    adminBusinessId,
    fetchingStatus,
    fetchingTemplates,
    saving,
    step09Record,
    lockedTemplateName,
  ]);

  const templates = useMemo(() => templatesData?.allDynamicReports ?? [], [templatesData]);

  // Templates available to select: unlocked ones, plus the currently locked one (if set)
  const selectableTemplates = useMemo(
    () => templates.filter(t => !t.isLocked || t.name === lockedTemplateName),
    [templates, lockedTemplateName],
  );

  const onTemplateSelected = useCallback(
    async (templateName: string) => {
      if (!adminBusinessId) return;
      await setStep09Status({ input: { ownerId: adminBusinessId, year, templateName } });
      refetchStatus();
    },
    [adminBusinessId, year, setStep09Status, refetchStatus],
  );

  return (
    <BaseStepCard
      {...props}
      status={status}
      description={
        status === 'completed'
          ? `Final template: ${lockedTemplateName}`
          : 'Select the final dynamic report template to lock for this fiscal year'
      }
    >
      {adminBusinessId && !fetchingTemplates && !fetchingStatus && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2">
            <Select
              value={lockedTemplateName ?? ''}
              onValueChange={onTemplateSelected}
              disabled={saving}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select a report template..." />
              </SelectTrigger>
              <SelectContent>
                {selectableTemplates.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No unlocked templates available
                  </SelectItem>
                ) : (
                  selectableTemplates.map(t => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {lockedTemplateName && (
              <span className="text-sm text-muted-foreground">Saved: {lockedTemplateName}</span>
            )}
          </div>
        </div>
      )}
    </BaseStepCard>
  );
}
