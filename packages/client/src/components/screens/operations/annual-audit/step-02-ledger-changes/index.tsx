import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Settings } from 'lucide-react';
import { useQuery } from 'urql';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible.js';
import {
  AnnualAuditStepStatus,
  ChargeSortByField,
  LedgerValidationStatusDocument,
} from '../../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../../helpers/index.js';
import { getLedgerValidationHref } from '../../../../charges-ledger-validation.js';
import { Badge } from '../../../../ui/badge.js';
import { CardContent } from '../../../../ui/card.js';
import { ApprovalControl, gqlStatusToStepStatus } from '../approval-control.js';
import {
  BaseStepCard,
  type BaseStepProps,
  type StepAction,
  type StepStatus,
} from '../step-base.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query LedgerValidationStatus($limit: Int, $filters: ChargeFilter) {
    chargesWithLedgerChanges(limit: $limit, filters: $filters) {
      charge {
        id
      }
    }
  }
`;

interface Step02Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step02LedgerChanges(props: Step02Props) {
  const [status, setStatus] = useState<StepStatus>('blocked');
  const [pendingChanges, setPendingChanges] = useState<number>(Infinity);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [overriddenStatus, setOverriddenStatus] = useState<StepStatus | undefined>(undefined);
  const { year, adminBusinessId, onStatusChange, id } = props;

  const [{ data, fetching, error }, fetchStatus] = useQuery({
    query: LedgerValidationStatusDocument,
    variables: {
      filters: {
        byOwners: adminBusinessId ? [adminBusinessId] : [],
        fromAnyDate: `${year}-01-01` as TimelessDateString,
        toAnyDate: `${year}-12-31` as TimelessDateString,
      },
    },
    pause: true,
  });

  const persistedStep02Record = useMemo(() => {
    if (!Array.isArray(props.manualData)) return undefined;
    return props.manualData.find(record => record.stepId === id);
  }, [props.manualData, id]);

  const persistedManualStatus = useMemo<StepStatus | undefined>(() => {
    const persistedStatus = persistedStep02Record?.status;
    if (!persistedStatus) return undefined;
    // Convert GQL status to StepStatus
    return gqlStatusToStepStatus(persistedStatus as AnnualAuditStepStatus);
  }, [persistedStep02Record]);

  const persistedManualNotes = persistedStep02Record?.notes ?? null;

  // Apply persisted override if it exists
  useEffect(() => {
    if (persistedManualStatus) {
      setOverriddenStatus(persistedManualStatus);
    }
  }, [persistedManualStatus]);

  // Report status changes to parent
  useEffect(() => {
    const finalStatus = overriddenStatus ?? status;
    if (onStatusChange) {
      onStatusChange(id, finalStatus);
    }
  }, [status, overriddenStatus, onStatusChange, id]);

  useEffect(() => {
    if (!data && !fetching && !error && adminBusinessId && !persistedManualStatus) {
      fetchStatus();
    }
  }, [data, fetching, error, adminBusinessId, persistedManualStatus, fetchStatus]);

  useEffect(() => {
    if (fetching) setStatus('loading');
  }, [fetching]);

  useEffect(() => {
    if (data?.chargesWithLedgerChanges) {
      const pendingChanges = data.chargesWithLedgerChanges.filter(
        charge => !!charge.charge?.id,
      ).length;
      setPendingChanges(pendingChanges);

      if (pendingChanges === 0) {
        setStatus('completed');
      } else {
        setStatus('in-progress');
      }
    }
  }, [data]);

  const href = useMemo(() => {
    return getLedgerValidationHref({
      byOwners: adminBusinessId ? [adminBusinessId] : undefined,
      fromAnyDate: `${year}-01-01` as TimelessDateString,
      toAnyDate: `${year}-12-31` as TimelessDateString,
      sortBy: {
        field: ChargeSortByField.Date,
        asc: false,
      },
    });
  }, [adminBusinessId, year]);

  const actions = useMemo((): StepAction[] => {
    if (persistedManualStatus) {
      return [
        { label: 'View Ledger Status', href },
        { label: 'Revalidate', onClick: fetchStatus, disabled: fetching },
      ];
    }
    return [{ label: 'View Ledger Status', href }];
  }, [persistedManualStatus, href, fetchStatus, fetching]);

  const finalStatus = overriddenStatus ?? status;
  const statusMismatch = overriddenStatus && overriddenStatus !== status;

  return (
    <BaseStepCard
      {...props}
      status={finalStatus}
      statusIndicator={
        fetching ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : statusMismatch ? (
          <Badge variant="outline" className="text-xs border-blue-200 text-blue-700">
            Manual override
          </Badge>
        ) : undefined
      }
      icon={<Settings className="h-4 w-4" />}
      actions={actions}
      isExpanded={isDetailsExpanded}
      onToggleExpanded={() => setIsDetailsExpanded(prev => !prev)}
    >
      {(pendingChanges > 0 || !persistedManualStatus) && (
        <CardContent className="p-2 border-t">
          {fetching ? (
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 animate-pulse">
              <Settings className="h-4 w-4 text-gray-400" />
              <div className="flex-1">
                <span className="text-sm text-gray-600 font-medium">
                  Checking for pending ledger changes...
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <div className="flex-1">
                <span className="text-sm text-red-800 font-medium">
                  {pendingChanges === Infinity
                    ? 'Trigger revalidation manually'
                    : `${pendingChanges} pending ledger change${pendingChanges > 1 ? 's' : ''} detected`}
                </span>
                {/* <div className="text-xs text-red-600 mt-1">
                Last updated: {new Date(ledgerStatus.lastUpdate).toLocaleString()}
              </div> */}
              </div>
              <Badge variant="destructive" className="text-xs">
                Action Required
              </Badge>
            </div>
          )}
        </CardContent>
      )}
      <Collapsible open={isDetailsExpanded}>
        <CollapsibleContent>
          {adminBusinessId && (
            <div className="px-6 pb-4 pt-2 border-t">
              <ApprovalControl
                ownerId={adminBusinessId}
                year={year}
                stepId={id}
                initialStatus={
                  (persistedStep02Record?.status as AnnualAuditStepStatus | undefined) ?? undefined
                }
                initialNotes={persistedManualNotes}
                onSaved={status => setOverriddenStatus(status)}
              />
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </BaseStepCard>
  );
}
