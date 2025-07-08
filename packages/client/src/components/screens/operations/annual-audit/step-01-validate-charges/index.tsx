import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { useQuery } from 'urql';
import {
  AccountantApprovalStatusDocument,
  AccountantStatus,
  ChargeSortByField,
} from '../../../../../gql/graphql.js';
import { TimelessDateString } from '../../../../../helpers/dates.js';
import { Badge } from '../../../../ui/badge.jsx';
import { Button } from '../../../../ui/button.jsx';
import { CardContent } from '../../../../ui/card.jsx';
import { Collapsible, CollapsibleContent } from '../../../../ui/collapsible.js';
import { getAllChargesHref } from '../../../charges/all-charges.jsx';
import {
  BaseStepCard,
  type BaseStepProps,
  type StepAction,
  type StepStatus,
} from '../step-base.jsx';

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

  // Report status changes to parent
  useEffect(() => {
    if (props.onStatusChange) {
      props.onStatusChange(props.id, status);
    }

    // Track if we've reported completion to avoid double counting
    if (status === 'completed' && !hasReportedCompletion) {
      setHasReportedCompletion(true);
    } else if (status !== 'completed' && hasReportedCompletion) {
      setHasReportedCompletion(false);
    }
  }, [status, props.onStatusChange, props.id, hasReportedCompletion]);

  const [{ data, fetching }, fetchStatus] = useQuery({
    query: AccountantApprovalStatusDocument,
    variables: {
      fromDate: `${props.year}-01-01` as TimelessDateString,
      toDate: `${props.year}-12-31` as TimelessDateString,
    },
  });

  useEffect(() => {
    if (!props.adminBusinessId) {
      setStatus('blocked');
    } else if (fetching) {
      setStatus('loading');
    }
  }, [props.adminBusinessId, fetching]);

  useEffect(() => {
    if (data?.accountantApprovalStatus) {
      const { totalCharges, approvedCount, pendingCount, unapprovedCount } =
        data.accountantApprovalStatus;
      const accountantApprovalStatus: ChargeValidationData = {
        approvedPercentage: (approvedCount / totalCharges) * 100 || 0,
        pendingPercentage: (pendingCount / totalCharges) * 100 || 0,
        unapprovedPercentage: (unapprovedCount / totalCharges) * 100 || 0,
        totalCharges: totalCharges,
        approvedCount: approvedCount,
        pendingCount: pendingCount,
        unapprovedCount: unapprovedCount,
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
    return getAllChargesHref({
      byOwners: props.adminBusinessId ? [props.adminBusinessId] : undefined,
      fromAnyDate: `${props.year}-01-01` as TimelessDateString,
      toAnyDate: `${props.year}-12-31` as TimelessDateString,
      accountantStatus: [AccountantStatus.Pending, AccountantStatus.Unapproved],
      sortBy: {
        field: ChargeSortByField.Date,
        asc: false,
      },
    });
  }, [props.adminBusinessId, props.year]);

  const actions: StepAction[] = [{ label: 'Review Charges', href }];

  const refreshData = async () => {
    await fetchStatus();
  };

  return (
    <BaseStepCard {...props} status={status} icon={<Eye className="h-4 w-4" />} actions={actions}>
      <Collapsible open={isDetailsExpanded}>
        <CardContent className="pt-0 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
            className="w-full justify-between p-2 h-auto"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Charge Validation Details</span>
              <Badge variant="outline" className="text-xs">
                {chargeData.pendingCount + chargeData.unapprovedCount} need attention
              </Badge>
            </div>
            {isDetailsExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CardContent>
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
                        Approved ({chargeData.approvedPercentage}%)
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
                        Pending ({chargeData.pendingPercentage}%)
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
                        Unapproved ({chargeData.unapprovedPercentage}%)
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
        </CollapsibleContent>
      </Collapsible>
    </BaseStepCard>
  );
}
