import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, PlusCircle } from 'lucide-react';
import { useQuery } from 'urql';
import {
  FinancialChargeEnum,
  useGenerateFinancialCharge,
} from '@/hooks/use-generate-financial-charge.js';
import { ROUTES } from '@/router/routes.js';
import {
  AnnualAuditStepStatus,
  AnnualFinancialChargesDocument,
} from '../../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../../helpers/dates.js';
import { Badge } from '../../../../ui/badge.js';
import { Button } from '../../../../ui/button.js';
import { CardContent } from '../../../../ui/card.js';
import { Collapsible, CollapsibleContent } from '../../../../ui/collapsible.js';
import { ApprovalControl, gqlStatusToStepStatus } from '../approval-control.js';
import { BaseStepCard, type BaseStepProps, type StepStatus } from '../step-base.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AnnualFinancialCharges($ownerId: UUID, $year: TimelessDate!) {
    annualFinancialCharges(ownerId: $ownerId, year: $year) {
      id
      revaluationCharge {
        id
      }
      taxExpensesCharge {
        id
      }
      depreciationCharge {
        id
      }
      recoveryReserveCharge {
        id
      }
      vacationReserveCharge {
        id
      }
      bankDepositsRevaluationCharge {
        id
      }
    }
  }
`;

interface Step04Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

type ChargeKey =
  | 'revaluationCharge'
  | 'taxExpensesCharge'
  | 'depreciationCharge'
  | 'recoveryReserveCharge'
  | 'vacationReserveCharge'
  | 'bankDepositsRevaluationCharge';

interface ChargeItem {
  key: ChargeKey;
  label: string;
  generateType: FinancialChargeEnum;
  required: boolean;
}

const CHARGE_ITEMS: ChargeItem[] = [
  {
    key: 'revaluationCharge',
    label: 'Revaluation Charge',
    generateType: FinancialChargeEnum.Revaluation,
    required: true,
  },
  {
    key: 'taxExpensesCharge',
    label: 'Tax Expenses Charge',
    generateType: FinancialChargeEnum.TaxExpenses,
    required: true,
  },
  {
    key: 'bankDepositsRevaluationCharge',
    label: 'Bank Deposits Revaluation Charge',
    generateType: FinancialChargeEnum.BankDeposits,
    required: false,
  },
  {
    key: 'depreciationCharge',
    label: 'Depreciation Charge',
    generateType: FinancialChargeEnum.Depreciation,
    required: false,
  },
  {
    key: 'recoveryReserveCharge',
    label: 'Recovery Reserve Charge',
    generateType: FinancialChargeEnum.RecoveryReserve,
    required: false,
  },
  {
    key: 'vacationReserveCharge',
    label: 'Vacation Reserve Charge',
    generateType: FinancialChargeEnum.VacationReserve,
    required: false,
  },
];

export function Step04FinancialCharges(props: Step04Props) {
  const [status, setStatus] = useState<StepStatus>('loading');
  const [isExpanded, setIsExpanded] = useState(false);
  const [overriddenStatus, setOverriddenStatus] = useState<StepStatus | undefined>(undefined);
  const { adminBusinessId, id, onStatusChange, year } = props;
  const yearEndDate = `${year}-12-31` as TimelessDateString;
  const { fetching: generatingCharge, generateFinancialCharge } = useGenerateFinancialCharge();

  const [{ data, fetching, error }, refetchFinancialCharges] = useQuery({
    query: AnnualFinancialChargesDocument,
    variables: {
      ownerId: adminBusinessId,
      year: yearEndDate,
    },
  });

  const persistedStepRecord = useMemo(() => {
    if (!Array.isArray(props.manualData)) return undefined;
    return props.manualData.find(record => record.stepId === id);
  }, [props.manualData, id]);

  const persistedManualStatus = useMemo<StepStatus | undefined>(() => {
    const persistedStatus = persistedStepRecord?.status;
    if (!persistedStatus) return undefined;
    return gqlStatusToStepStatus(persistedStatus as AnnualAuditStepStatus);
  }, [persistedStepRecord]);

  const persistedManualNotes = persistedStepRecord?.notes ?? null;

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

  const chargeRows = useMemo(() => {
    const result = data?.annualFinancialCharges;

    return CHARGE_ITEMS.map(item => {
      const chargeId = result?.[item.key]?.id;
      return {
        ...item,
        chargeId,
        exists: !!chargeId,
      };
    });
  }, [data]);

  useEffect(() => {
    if (!adminBusinessId) {
      setStatus('blocked');
      return;
    }

    if (fetching || generatingCharge) {
      setStatus('loading');
      return;
    }

    if (error || !data?.annualFinancialCharges) {
      setStatus('blocked');
      return;
    }

    const requiredRows = chargeRows.filter(item => item.required);
    const requiredCompleted = requiredRows.filter(item => item.exists).length;

    if (requiredCompleted === requiredRows.length) {
      setStatus('completed');
    } else if (requiredCompleted > 0) {
      setStatus('in-progress');
    } else {
      setStatus('pending');
    }
  }, [adminBusinessId, chargeRows, data, error, fetching, generatingCharge]);

  const onGenerateClicked = useCallback(
    async (type: FinancialChargeEnum) => {
      if (!adminBusinessId) {
        return;
      }
      const generationSucceeded = await generateFinancialCharge({
        type,
        ownerId: adminBusinessId,
        date: yearEndDate,
      });

      if (generationSucceeded) {
        await refetchFinancialCharges();
      }
    },
    [adminBusinessId, generateFinancialCharge, refetchFinancialCharges, yearEndDate],
  );

  const getChargeStatusIcon = (item: { exists: boolean; required: boolean }) => {
    if (item.exists) {
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    }
    if (item.required) {
      return <AlertCircle className="h-4 w-4 text-orange-600" />;
    }
    return <AlertCircle className="h-4 w-4 text-gray-400" />;
  };

  const getChargeBadge = (item: { exists: boolean; required: boolean }) => {
    if (item.exists) {
      return <Badge variant="default">Exists</Badge>;
    }
    if (item.required) {
      return <Badge variant="outline">Missing</Badge>;
    }
    return <Badge variant="secondary">Optional</Badge>;
  };
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
      isExpanded={isExpanded}
      onToggleExpanded={() => setIsExpanded(prev => !prev)}
    >
      {adminBusinessId && (
        <Collapsible open={isExpanded}>
          <CollapsibleContent>
            <CardContent className="pt-0 border-t">
              <div className="space-y-2 mt-3">
                {chargeRows.map(item => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-background"
                  >
                    <div className="flex items-center gap-2">
                      {getChargeStatusIcon(item)}
                      <span className="text-sm font-medium">{item.label}</span>
                      {getChargeBadge(item)}
                    </div>

                    {item.exists && item.chargeId ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={ROUTES.CHARGES.DETAIL(item.chargeId)}>View</a>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onGenerateClicked(item.generateType)}
                        disabled={generatingCharge || status === 'loading'}
                      >
                        <PlusCircle className="h-4 w-4 mr-1" />
                        Generate
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
            {adminBusinessId && (
              <div className="px-6 pb-4 pt-2 border-t">
                <ApprovalControl
                  ownerId={adminBusinessId}
                  year={year}
                  stepId={id}
                  initialStatus={
                    (persistedStepRecord?.status as AnnualAuditStepStatus | undefined) ?? undefined
                  }
                  initialNotes={persistedManualNotes}
                  onSaved={status => setOverriddenStatus(status)}
                />
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </BaseStepCard>
  );
}
