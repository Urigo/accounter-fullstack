import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useQuery } from 'urql';
import { useSetAnnualAuditStep09Status } from '@/hooks/use-set-annual-audit-step09-status.js';
import {
  AllDynamicReportsDocument,
  AnnualAuditReportType,
  AnnualAuditStepStatus,
  Step09SaveTemplateStatusDocument,
} from '../../../../../gql/graphql.js';
import { Button } from '../../../../ui/button.js';
import { BaseStepCard, type BaseStepProps, type StepStatus } from '../step-base.js';
import { selectableTemplateOptions, TemplateSelect } from '../template-select.js';
import { findStepEvidence, parseFinalTemplates, parseWorkingTemplates } from '../template-slots.js';

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

const WORKING_TAG = 'working';

interface FinalSlotProps {
  label: string;
  reportType: AnnualAuditReportType;
  finalName: string | null;
  workingName: string | null;
  templates: ReadonlyArray<{ name: string; isLocked: boolean }>;
  /** Names this year's step 09 already locks — they stay selectable in both pickers */
  lockedNames: ReadonlyArray<string | null>;
  onSelect: (reportType: AnnualAuditReportType, templateName: string) => void;
  saving: boolean;
}

function FinalSlot({
  label,
  reportType,
  finalName,
  workingName,
  templates,
  lockedNames,
  onSelect,
  saving,
}: FinalSlotProps): ReactElement {
  const options = useMemo(
    () =>
      selectableTemplateOptions(
        templates,
        lockedNames,
        workingName ? { [workingName]: WORKING_TAG } : {},
      ),
    [templates, lockedNames, workingName],
  );

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2"
      data-testid={`final-${reportType}`}
    >
      <div className="w-32 text-sm font-medium">{label}</div>
      <TemplateSelect
        value={finalName}
        options={options}
        placeholder={workingName ? `Working: ${workingName}` : 'Select a report template...'}
        onChange={name => {
          if (name) onSelect(reportType, name);
        }}
        disabled={saving}
        ariaLabel={`Final ${label} template`}
      />
      {finalName && <span className="text-sm text-muted-foreground">Locked: {finalName}</span>}
    </div>
  );
}

export function Step09SaveTemplate(props: Step09Props) {
  const [status, setStatus] = useState<StepStatus>('pending');
  const { adminBusinessId, id, onStatusChange, year, manualData, refetchManualData } = props;
  const { fetching: saving, setStep09Status } = useSetAnnualAuditStep09Status();

  const [{ data: statusData, fetching: fetchingStatus }, refetchStatus] = useQuery({
    query: Step09SaveTemplateStatusDocument,
    variables: { ownerId: adminBusinessId!, year },
    pause: !adminBusinessId,
  });

  const [{ data: templatesData, fetching: fetchingTemplates }, refetchTemplates] = useQuery({
    query: AllDynamicReportsDocument,
  });

  // Report status changes to parent
  useEffect(() => onStatusChange?.(id, status), [status, onStatusChange, id]);

  const step09Record = useMemo(
    () => statusData?.annualAuditStepStatuses.find(s => s.stepId === id),
    [statusData, id],
  );

  const final = useMemo(() => parseFinalTemplates(step09Record?.evidence), [step09Record]);
  // Working templates are picked in step 05, which shares the page's step-status query
  const working = useMemo(
    () => parseWorkingTemplates(findStepEvidence(manualData, '5')),
    [manualData],
  );

  const bothLocked = !!final.balanceSheetTemplateName && !!final.profitAndLossTemplateName;

  // Update status badge
  useEffect(() => {
    if (!adminBusinessId) {
      setStatus('blocked');
    } else if (fetchingStatus || fetchingTemplates || saving) {
      setStatus('loading');
    } else if (step09Record?.status === AnnualAuditStepStatus.Completed && bothLocked) {
      setStatus('completed');
    } else if (step09Record?.status === AnnualAuditStepStatus.InProgress) {
      setStatus('in-progress');
    } else {
      setStatus('pending');
    }
  }, [adminBusinessId, fetchingStatus, fetchingTemplates, saving, step09Record, bothLocked]);

  const templates = useMemo(() => templatesData?.allDynamicReports ?? [], [templatesData]);
  const lockedNames = useMemo(
    () => [final.balanceSheetTemplateName, final.profitAndLossTemplateName],
    [final],
  );

  const afterSave = useCallback(() => {
    refetchStatus({ requestPolicy: 'network-only' });
    // Locking changes which templates are selectable
    refetchTemplates({ requestPolicy: 'network-only' });
    refetchManualData?.();
  }, [refetchStatus, refetchTemplates, refetchManualData]);

  const onTemplateSelected = useCallback(
    async (reportType: AnnualAuditReportType, templateName: string) => {
      if (!adminBusinessId) return;
      await setStep09Status({
        input: { ownerId: adminBusinessId, year, templateName, reportType },
      });
      afterSave();
    },
    [adminBusinessId, year, setStep09Status, afterSave],
  );

  // One click to lock what was worked on, for whichever reports differ from what's locked
  const pendingWorking = useMemo(() => {
    const pending: Array<{ reportType: AnnualAuditReportType; templateName: string }> = [];
    if (
      working.balanceSheetTemplateName &&
      working.balanceSheetTemplateName !== final.balanceSheetTemplateName
    ) {
      pending.push({
        reportType: AnnualAuditReportType.BalanceSheet,
        templateName: working.balanceSheetTemplateName,
      });
    }
    if (
      working.profitAndLossTemplateName &&
      working.profitAndLossTemplateName !== final.profitAndLossTemplateName
    ) {
      pending.push({
        reportType: AnnualAuditReportType.ProfitAndLoss,
        templateName: working.profitAndLossTemplateName,
      });
    }
    return pending;
  }, [working, final]);

  const lockWorkingTemplates = useCallback(async () => {
    if (!adminBusinessId || pendingWorking.length === 0) return;
    const [first, second] = pendingWorking;
    if (second && first.templateName === second.templateName) {
      // Same template for both reports: one call, no reportType
      await setStep09Status({
        input: { ownerId: adminBusinessId, year, templateName: first.templateName },
      });
    } else {
      for (const { reportType, templateName } of pendingWorking) {
        await setStep09Status({
          input: { ownerId: adminBusinessId, year, templateName, reportType },
        });
      }
    }
    afterSave();
  }, [adminBusinessId, year, pendingWorking, setStep09Status, afterSave]);

  const description = useMemo(() => {
    if (status !== 'completed') {
      return 'Select the final Balance Sheet and Profit and Loss templates to lock for this fiscal year';
    }
    if (final.balanceSheetTemplateName === final.profitAndLossTemplateName) {
      return `Final template: ${final.balanceSheetTemplateName}`;
    }
    return `Final templates: Balance Sheet ${final.balanceSheetTemplateName} · Profit and Loss ${final.profitAndLossTemplateName}`;
  }, [status, final]);

  return (
    <BaseStepCard {...props} status={status} description={description}>
      {adminBusinessId && !fetchingTemplates && !fetchingStatus && (
        <div className="space-y-3 px-6 pb-4">
          <FinalSlot
            label="Balance Sheet"
            reportType={AnnualAuditReportType.BalanceSheet}
            finalName={final.balanceSheetTemplateName}
            workingName={working.balanceSheetTemplateName}
            templates={templates}
            lockedNames={lockedNames}
            onSelect={onTemplateSelected}
            saving={saving}
          />
          <FinalSlot
            label="Profit and Loss"
            reportType={AnnualAuditReportType.ProfitAndLoss}
            finalName={final.profitAndLossTemplateName}
            workingName={working.profitAndLossTemplateName}
            templates={templates}
            lockedNames={lockedNames}
            onSelect={onTemplateSelected}
            saving={saving}
          />
          {pendingWorking.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={lockWorkingTemplates}
              data-testid="lock-working-templates"
            >
              Lock working {pendingWorking.length === 1 ? 'template' : 'templates'}
            </Button>
          )}
        </div>
      )}
    </BaseStepCard>
  );
}
