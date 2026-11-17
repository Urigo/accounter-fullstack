import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { ExternalLink } from 'lucide-react';
import { useQuery } from 'urql';
import type { AnnualAuditStepStatus } from '@/gql/graphql.js';
import { AnnualAuditReportType, Step05TemplatesDocument } from '@/gql/graphql.js';
import type { TimelessDateString } from '@/helpers/index.js';
import { useSetAnnualAuditWorkingTemplate } from '@/hooks/use-set-annual-audit-working-template.js';
import { ROUTES } from '@/router/routes.js';
import { Collapsible, CollapsibleContent } from '../../../../ui/collapsible.js';
import { ApprovalControl, gqlStatusToStepStatus } from '../approval-control.js';
import { balanceSheetHref, profitAndLossHref } from '../report-links.js';
import {
  BaseStepCard,
  type BaseStepProps,
  type StepAction,
  type StepStatus,
} from '../step-base.js';
import { selectableTemplateOptions, TemplateSelect } from '../template-select.js';
import { findStepEvidence, parseFinalTemplates, parseWorkingTemplates } from '../template-slots.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query Step05Templates($ownerId: UUID!, $prevYear: Int!) {
    annualAuditStepStatuses(ownerId: $ownerId, year: $prevYear) {
      id
      stepId
      status
      evidence
    }
    allDynamicReports {
      id
      name
      isLocked
    }
  }
`;

interface Step05Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

interface SlotRowProps {
  label: string;
  reportType: AnnualAuditReportType;
  baselineYear: number;
  baselineName: string | null;
  workingName: string | null;
  templates: ReadonlyArray<{ name: string; isLocked: boolean }>;
  hrefFor: (templateName: string) => string;
  onWorkingChange: (reportType: AnnualAuditReportType, templateName: string | null) => void;
  onOpen: () => void;
  saving: boolean;
}

function SlotRow({
  label,
  reportType,
  baselineYear,
  baselineName,
  workingName,
  templates,
  hrefFor,
  onWorkingChange,
  onOpen,
  saving,
}: SlotRowProps): ReactElement {
  const options = useMemo(
    () => selectableTemplateOptions(templates, [workingName]),
    [templates, workingName],
  );

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2" data-testid={`slot-${reportType}`}>
      <div className="w-32 text-sm font-medium">{label}</div>
      <div className="flex w-72 items-center gap-1 truncate text-sm">
        <span className="text-muted-foreground">Baseline ({baselineYear}):</span>
        {baselineName ? (
          <a
            href={hrefFor(baselineName)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
            data-testid={`baseline-link-${reportType}`}
          >
            {baselineName}
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <span className="italic text-muted-foreground">none locked</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Working:</span>
        <TemplateSelect
          value={workingName}
          options={options}
          placeholder={baselineName ? 'Same as baseline' : 'Select a working template...'}
          clearLabel={baselineName ? 'Back to baseline' : 'Clear'}
          onChange={name => onWorkingChange(reportType, name)}
          onOpen={onOpen}
          disabled={saving}
          ariaLabel={`Working ${label} template`}
        />
        {workingName && (
          <a
            href={hrefFor(workingName)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
            data-testid={`working-link-${reportType}`}
          >
            Open
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  );
}

export function Step05MainProcess(props: Step05Props) {
  const [status, setStatus] = useState<StepStatus>('pending');
  const [isExpanded, setIsExpanded] = useState(false);
  const { adminBusinessId, id, onStatusChange, year, manualData, refetchManualData } = props;
  const { fetching: saving, setWorkingTemplate } = useSetAnnualAuditWorkingTemplate();

  // Previous year's statuses (baseline = its step 09 final templates) + the template list
  const [{ data }, refetchTemplates] = useQuery({
    query: Step05TemplatesDocument,
    variables: { ownerId: adminBusinessId ?? '', prevYear: year - 1 },
    pause: !adminBusinessId,
  });

  const baseline = useMemo(
    () => parseFinalTemplates(findStepEvidence(data?.annualAuditStepStatuses, '9')),
    [data],
  );
  // This year's working templates live on this step's own status row
  const working = useMemo(
    () => parseWorkingTemplates(findStepEvidence(manualData, id)),
    [manualData, id],
  );
  const templates = useMemo(() => data?.allDynamicReports ?? [], [data]);

  const onWorkingChange = useCallback(
    async (reportType: AnnualAuditReportType, templateName: string | null) => {
      if (!adminBusinessId) return;
      await setWorkingTemplate({
        input: { ownerId: adminBusinessId, year, templateName, reportType },
      });
      refetchManualData?.();
    },
    [adminBusinessId, year, setWorkingTemplate, refetchManualData],
  );

  // The template list may change in another tab (a new working copy saved), so re-read it on open
  const onPickerOpen = useCallback(
    () => refetchTemplates({ requestPolicy: 'network-only' }),
    [refetchTemplates],
  );

  const persistedStepRecord = useMemo(() => {
    if (!Array.isArray(manualData)) return undefined;
    return manualData.find(record => record.stepId === id);
  }, [manualData, id]);

  const persistedManualStatus = useMemo<StepStatus | undefined>(() => {
    const persistedStatus = persistedStepRecord?.status;
    if (!persistedStatus) {
      return undefined;
    }
    return gqlStatusToStepStatus(persistedStatus as AnnualAuditStepStatus);
  }, [persistedStepRecord]);

  const persistedManualNotes = persistedStepRecord?.notes ?? null;

  // Apply persisted override if it exists
  useEffect(() => {
    if (persistedManualStatus) {
      setStatus(persistedManualStatus);
    }
  }, [persistedManualStatus]);

  // Report status changes to parent
  useEffect(() => onStatusChange?.(id, status), [status, onStatusChange, id]);

  const bsHref = useCallback(
    (name: string) => balanceSheetHref(adminBusinessId, year, name),
    [adminBusinessId, year],
  );
  const pnlHref = useCallback(
    (name: string) => profitAndLossHref(adminBusinessId, year, name),
    [adminBusinessId, year],
  );

  const actions = useMemo((): StepAction[] => {
    // Each report opens its working template, or last year's final one until a working one is set
    const bsTemplate = working.balanceSheetTemplateName ?? baseline.balanceSheetTemplateName;
    const pnlTemplate = working.profitAndLossTemplateName ?? baseline.profitAndLossTemplateName;

    const dynamicReportActions: StepAction[] = [];
    if (bsTemplate) {
      dynamicReportActions.push({
        label: 'Balance Sheet',
        href: bsHref(bsTemplate),
        openInNewTab: true,
      });
    }
    if (pnlTemplate) {
      dynamicReportActions.push({
        label: 'Profit and Loss',
        href: pnlHref(pnlTemplate),
        openInNewTab: true,
      });
    }
    if (dynamicReportActions.length === 0) {
      dynamicReportActions.push({
        label: 'Create Dynamic Report Template',
        href: ROUTES.REPORTS.DYNAMIC_REPORT(),
        openInNewTab: true,
      });
    }

    return [
      ...dynamicReportActions,
      {
        label: 'Trial Balance',
        href: ROUTES.REPORTS.TRIAL_BALANCE({
          ownerIds: adminBusinessId ? [adminBusinessId] : undefined,
          fromDate: '1900-01-01' as TimelessDateString,
          toDate: `${year}-12-31` as TimelessDateString,
          isShowZeroedAccounts: true,
        }),
      },
      { label: 'Review Tax Report', href: ROUTES.REPORTS.TAX(year) },
    ];
  }, [year, adminBusinessId, working, baseline, bsHref, pnlHref]);

  return (
    <BaseStepCard
      {...props}
      status={status}
      isExpanded={isExpanded}
      onToggleExpanded={() => setIsExpanded(prev => !prev)}
      actions={actions}
    >
      {adminBusinessId && (
        <>
          <div className="space-y-3 px-6 pb-4" data-testid="report-templates">
            <SlotRow
              label="Balance Sheet"
              reportType={AnnualAuditReportType.BalanceSheet}
              baselineYear={year - 1}
              baselineName={baseline.balanceSheetTemplateName}
              workingName={working.balanceSheetTemplateName}
              templates={templates}
              hrefFor={bsHref}
              onWorkingChange={onWorkingChange}
              onOpen={onPickerOpen}
              saving={saving}
            />
            <SlotRow
              label="Profit and Loss"
              reportType={AnnualAuditReportType.ProfitAndLoss}
              baselineYear={year - 1}
              baselineName={baseline.profitAndLossTemplateName}
              workingName={working.profitAndLossTemplateName}
              templates={templates}
              hrefFor={pnlHref}
              onWorkingChange={onWorkingChange}
              onOpen={onPickerOpen}
              saving={saving}
            />
          </div>
          <Collapsible open={isExpanded}>
            <CollapsibleContent>
              <div className="px-6 pb-4 pt-2 border-t">
                <ApprovalControl
                  ownerId={adminBusinessId}
                  year={year}
                  stepId={id}
                  initialStatus={
                    (persistedStepRecord?.status as AnnualAuditStepStatus | undefined) ?? undefined
                  }
                  initialNotes={persistedManualNotes}
                  onSaved={status => setStatus(status)}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </BaseStepCard>
  );
}
