import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Eye, Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { ROUTES } from '@/router/routes.js';
import {
  AccountantApprovalStatusDocument,
  AccountantStatus,
  AnnualAuditStepStatus,
  ChargeSortByField,
} from '../../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../../helpers/dates.js';
import { Badge } from '../../../../ui/badge.js';
import { Button } from '../../../../ui/button.js';
import { CardContent } from '../../../../ui/card.js';
import { Collapsible, CollapsibleContent } from '../../../../ui/collapsible.js';
import { ApprovalControl, gqlStatusToStepStatus } from '../approval-control.js';
import {
  BaseStepCard,
  type BaseStepProps,
  type StepAction,
  type StepStatus,
} from '../step-base.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AccountantApprovalStatus($fromDate: TimelessDate!, $toDate: TimelessDate!) {
    accountantApprovalStatus(from: $fromDate, to: $toDate) {
      totalCharges
      approvedCount
      pendingCount
      unapprovedCount
    }
  }
`;

interface ChargeValidationData {
  approvedPercentage: number;
  pendingPercentage: number;
  unapprovedPercentage: number;
  totalCharges: number;
  approvedCount: number;
  pendingCount: number;
  unapprovedCount: number;
}

interface Step01Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step01ValidateCharges(props: Step01Props) {
  const [status, setStatus] = useState<StepStatus>('loading');
  const [chargeData, setChargeData] = useState<ChargeValidationData>({
    approvedPercentage: 0,
    pendingPercentage: 0,
    unapprovedPercentage: 100,
    totalCharges: 1,
    approvedCount: 0,
    pendingCount: 0,
    unapprovedCount: 1,
  });
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [hasReportedCompletion, setHasReportedCompletion] = useState(false);
  const [overriddenStatus, setOverriddenStatus] = useState<StepStatus | undefined>(undefined);

  const { adminBusinessId, id, onStatusChange, year } = props;

  const [{ data, fetching, error }, fetchStatus] = useQuery({
    query: AccountantApprovalStatusDocument,
    variables: {
      fromDate: `${year}-01-01` as TimelessDateString,
      toDate: `${year}-12-31` as TimelessDateString,
    },
    pause: true,
  });

  const refreshData = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  const persistedStep01Record = useMemo(() => {
    if (!Array.isArray(props.manualData)) return undefined;
    return props.manualData.find(record => record.stepId === id);
  }, [props.manualData, id]);

  const persistedManualStatus = useMemo<StepStatus | undefined>(() => {
    const persistedStatus = persistedStep01Record?.status;
    if (!persistedStatus) {
      return undefined;
    }
    return gqlStatusToStepStatus(persistedStatus as AnnualAuditStepStatus);
  }, [persistedStep01Record]);

  useEffect(() => {
    if (adminBusinessId && !persistedManualStatus && !fetching && !data && !error) {
      refreshData();
    }
  }, [adminBusinessId, persistedManualStatus, fetching, data, error, refreshData]);

  const persistedManualNotes = persistedStep01Record?.notes ?? null;

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

    // Track if we've reported completion to avoid double counting
    if (finalStatus === 'completed' && !hasReportedCompletion) {
      setHasReportedCompletion(true);
    } else if (finalStatus !== 'completed' && hasReportedCompletion) {
      setHasReportedCompletion(false);
    }
  }, [status, overriddenStatus, onStatusChange, id, hasReportedCompletion]);

  useEffect(() => {
    if (!adminBusinessId) {
      setStatus('blocked');
    } else if (fetching && !persistedManualStatus) {
      setStatus('loading');
    }
  }, [adminBusinessId, fetching, persistedManualStatus]);

  useEffect(() => {
    if (data?.accountantApprovalStatus) {
      const { totalCharges, approvedCount, pendingCount, unapprovedCount } =
        data.accountantApprovalStatus;
      const accountantApprovalStatus: ChargeValidationData = {
        approvedPercentage: (approvedCount / totalCharges) * 100 || 0,
        pendingPercentage: (pendingCount / totalCharges) * 100 || 0,
        unapprovedPercentage: (unapprovedCount / totalCharges) * 100 || 0,
        totalCharges,
        approvedCount,
        pendingCount,
        unapprovedCount,
      };

      setChargeData(accountantApprovalStatus);

      // Determine status based on data
      if (
        accountantApprovalStatus.pendingPercentage === 0 &&
        accountantApprovalStatus.unapprovedPercentage === 0
      ) {
        setStatus('completed');
      } else if (
        accountantApprovalStatus.pendingPercentage + accountantApprovalStatus.unapprovedPercentage <
        30
      ) {
        setStatus('in-progress');
      } else {
        setStatus('pending');
      }
    }
  }, [data]);

  const href = useMemo(() => {
    return ROUTES.CHARGES.ALL({
      byOwners: adminBusinessId ? [adminBusinessId] : undefined,
      fromAnyDate: `${year}-01-01` as TimelessDateString,
      toAnyDate: `${year}-12-31` as TimelessDateString,
      accountantStatus: [AccountantStatus.Pending, AccountantStatus.Unapproved],
      sortBy: {
        field: ChargeSortByField.Date,
        asc: false,
      },
    });
  }, [adminBusinessId, year]);

  const actions = useMemo((): StepAction[] => {
    if (persistedManualStatus) {
      return [
        { label: 'Review Charges', href },
        { label: 'Revalidate', onClick: refreshData, disabled: fetching },
      ];
    }
    return [{ label: 'Review Charges', href }];
  }, [persistedManualStatus, href, refreshData, fetching]);

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
      icon={<Eye className="h-4 w-4" />}
      actions={actions}
      isExpanded={isDetailsExpanded}
      footer={
        <div className="w-full flex items-center gap-2 pt-2 border-t">
          <span className="text-sm font-medium">Charge Validation Details</span>
          <Badge variant="outline" className="text-xs">
            {chargeData.pendingCount + chargeData.unapprovedCount} need attention
          </Badge>
        </div>
      }
      onToggleExpanded={() => setIsDetailsExpanded(prev => !prev)}
    >
      <Collapsible open={isDetailsExpanded}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium">Charge Review Progress</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {chargeData.totalCharges.toLocaleString()} total charges
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={refreshData}
                      disabled={status === 'loading'}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Combined Progress Bar */}
                <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${chargeData.approvedPercentage}%` }}
                  />
                  <div
                    className="absolute top-0 h-full bg-orange-500 transition-all duration-300"
                    style={{
                      left: `${chargeData.approvedPercentage}%`,
                      width: `${chargeData.pendingPercentage}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 h-full bg-red-500 transition-all duration-300"
                    style={{
                      left: `${chargeData.approvedPercentage + chargeData.pendingPercentage}%`,
                      width: `${chargeData.unapprovedPercentage}%`,
                    }}
                  />
                </div>

                {/* Legend */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <div>
                      <div className="font-medium text-green-700">
                        Approved ({chargeData.approvedPercentage.toFixed(2)}%)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {chargeData.approvedCount.toLocaleString()} charges
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full" />
                    <div>
                      <div className="font-medium text-orange-700">
                        Pending ({chargeData.pendingPercentage.toFixed(2)}%)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {chargeData.pendingCount.toLocaleString()} charges
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <div>
                      <div className="font-medium text-red-700">
                        Unapproved ({chargeData.unapprovedPercentage.toFixed(2)}%)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {chargeData.unapprovedCount.toLocaleString()} charges
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {(chargeData.pendingPercentage > 0 || chargeData.unapprovedPercentage > 0) && (
                <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-orange-800">
                    {chargeData.pendingCount + chargeData.unapprovedCount} charges need review
                    before proceeding
                  </span>
                </div>
              )}
            </div>
          </CardContent>
          {adminBusinessId && (
            <div className="px-6 pb-4 pt-2 border-t">
              <ApprovalControl
                ownerId={adminBusinessId}
                year={year}
                stepId={id}
                initialStatus={
                  (persistedStep01Record?.status as AnnualAuditStepStatus | undefined) ?? undefined
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
