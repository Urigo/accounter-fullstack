import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { useQuery } from 'urql';
import { getChargeHref } from '@/components/screens/charges/charge.js';
import {
  FinancialChargeEnum,
  useGenerateFinancialCharge,
} from '@/hooks/use-generate-financial-charge.js';
import {
  AccountantApprovalStatusDocument,
  AnnualFinancialChargesDocument,
} from '../../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../../helpers/dates.js';
import { Badge } from '../../../../ui/badge.js';
import { Button } from '../../../../ui/button.js';
import { CardContent } from '../../../../ui/card.js';
import { Collapsible, CollapsibleContent } from '../../../../ui/collapsible.js';
import {
  BaseStepCard,
  type BaseStepProps,
  type StepAction,
  type StepStatus,
} from '../step-base.js';

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

type FinancialChargesStatus = Record<FinancialChargeEnum, string | undefined>;

interface Step01Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step04FinancialCharges(props: Step01Props) {
  const [status, setStatus] = useState<StepStatus>('blocked');
  const [chargesStatus, setChargesStatus] = useState<FinancialChargesStatus>({
    [FinancialChargeEnum.Revaluation]: undefined,
    [FinancialChargeEnum.TaxExpenses]: undefined,
    [FinancialChargeEnum.Depreciation]: undefined,
    [FinancialChargeEnum.RecoveryReserve]: undefined,
    [FinancialChargeEnum.VacationReserve]: undefined,
    [FinancialChargeEnum.BankDeposits]: undefined,
  });
  const { fetching: generatingCharge, generateFinancialCharge } = useGenerateFinancialCharge();

  const [{ data, fetching }, fetchAnnualCharges] = useQuery({
    query: AnnualFinancialChargesDocument,
    variables: {
      ownerId: props.adminBusinessId,
      year: `${props.year}-12-31` as TimelessDateString,
    },
  });

  const { adminBusinessId, id, onStatusChange, year } = props;

  // Report status changes to parent
  useEffect(() => onStatusChange?.(id, status), [status, onStatusChange, id]);

  // Update status
  useEffect(() => {
    if (!adminBusinessId) {
      setStatus('blocked');
    } else if (fetching || generatingCharge) {
      setStatus('loading');
    } else if (chargesStatus) {
      let status: StepStatus = 'pending';
      const chargesStatuses = Object.values(chargesStatus);
      if (chargesStatuses.filter(Boolean).length) {
        if (chargesStatuses.includes(undefined)) {
          status = 'in-progress';
        } else {
          status = 'completed';
        }
      }
      setStatus(status);
    }
  }, [chargesStatus, fetching, adminBusinessId, generatingCharge]);

  // Update charges status
  useEffect(() => {
    if (data) {
      setChargesStatus({
        [FinancialChargeEnum.Revaluation]: data.annualFinancialCharges.revaluationCharge?.id,
        [FinancialChargeEnum.TaxExpenses]: data.annualFinancialCharges.taxExpensesCharge?.id,
        [FinancialChargeEnum.Depreciation]: data.annualFinancialCharges.depreciationCharge?.id,
        [FinancialChargeEnum.RecoveryReserve]:
          data.annualFinancialCharges.recoveryReserveCharge?.id,
        [FinancialChargeEnum.VacationReserve]:
          data.annualFinancialCharges.vacationReserveCharge?.id,
        [FinancialChargeEnum.BankDeposits]:
          data.annualFinancialCharges.bankDepositsRevaluationCharge?.id,
      });
    }
  }, [data, setChargesStatus]);

  const onGenerateChargeClicked = useCallback(
    (type: FinancialChargeEnum) =>
      adminBusinessId
        ? generateFinancialCharge({
            type,
            ownerId: adminBusinessId,
            date: `${year}-12-31` as TimelessDateString,
          }).finally(() => {
            // Refresh the data after generating the charge
            fetchAnnualCharges();
          })
        : Promise.resolve(),
    [adminBusinessId, generateFinancialCharge, year, fetchAnnualCharges],
  );

  const actions: StepAction[] = useMemo(() => {
    function createStepAction(type: FinancialChargeEnum, label: string): StepAction {
      const isCompleted = chargesStatus[type];
      return {
        label: `${label}${isCompleted ? ' ✅' : ''}`,
        disabled: fetching || !!isCompleted,
        ...(isCompleted
          ? {
              href: getChargeHref(isCompleted),
            }
          : { onClick: () => onGenerateChargeClicked(type) }),
      };
    }
    return [
      createStepAction(FinancialChargeEnum.VacationReserve, 'Vacation Reserves'),
      createStepAction(FinancialChargeEnum.RecoveryReserve, 'Recovery Reserves'),
      createStepAction(FinancialChargeEnum.BankDeposits, 'Bank Deposits'),
      createStepAction(FinancialChargeEnum.Revaluation, 'Revaluation'),
      createStepAction(FinancialChargeEnum.TaxExpenses, 'Tax Expenses'),
      createStepAction(FinancialChargeEnum.Depreciation, 'Depreciation'),
    ];
  }, [onGenerateChargeClicked, fetching, chargesStatus]);

  return (
    <BaseStepCard {...props} status={status} icon={<Eye className="h-4 w-4" />} actions={actions} />
  );
}
