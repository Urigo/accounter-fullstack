import { useEffect, useMemo, useState } from 'react';
import type { AnnualAuditStepStatus } from '@/gql/graphql.js';
import type { TimelessDateString } from '@/helpers/index.js';
import { ROUTES } from '@/router/routes.js';
// import { CardContent } from '../../../../ui/card.js';
import { Collapsible, CollapsibleContent } from '../../../../ui/collapsible.js';
import { ApprovalControl, gqlStatusToStepStatus } from '../approval-control.js';
import {
  BaseStepCard,
  type BaseStepProps,
  type StepAction,
  type StepStatus,
} from '../step-base.js';

interface Step05Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step05MainProcess(props: Step05Props) {
  const [status, setStatus] = useState<StepStatus>('pending');
  const [isExpanded, setIsExpanded] = useState(false);
  const { adminBusinessId, id, onStatusChange } = props;

  const persistedStepRecord = useMemo(() => {
    if (!Array.isArray(props.manualData)) return undefined;
    return props.manualData.find(record => record.stepId === id);
  }, [props.manualData, id]);

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

  const actions = useMemo((): StepAction[] => {
    return [
      { label: 'Manage Conto Tree', href: ROUTES.REPORTS.CONTO({}) },
      // { label: 'Open Checklist', href: '/validations/checklist' },
      // { label: 'Compare VAT', href: '/vat/comparison' },
      // { label: 'Generate Draft', href: '/depreciation/draft' },
      // { label: 'Manage Audit Checks', href: '/audit/checks' },
      {
        label: 'Trial Balance',
        href: ROUTES.REPORTS.TRIAL_BALANCE({
          ownerIds: adminBusinessId ? [adminBusinessId] : undefined,
          fromDate: '1900-01-01' as TimelessDateString,
          toDate: `${props.year}-12-31` as TimelessDateString,
          isShowZeroedAccounts: true,
        }),
      },
      { label: 'Review Tax Report', href: ROUTES.REPORTS.TAX(props.year) },
      // { label: 'Cash Flow Analysis', href: '/cashflow/analysis' },
    ];
  }, [props.year, adminBusinessId]);

  return (
    <BaseStepCard
      {...props}
      status={status}
      isExpanded={isExpanded}
      onToggleExpanded={() => setIsExpanded(prev => !prev)}
      actions={actions}
    >
      {adminBusinessId && (
        <Collapsible open={isExpanded}>
          <CollapsibleContent>
            {/* <CardContent className="pt-0 border-t">
              <div className="space-y-2 mt-3" />
            </CardContent> */}
            <div className="px-6 pb-4 pt-2 border-t">
              <ApprovalControl
                ownerId={adminBusinessId}
                year={props.year}
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
      )}
    </BaseStepCard>
  );
}
