/* eslint-disable @typescript-eslint/no-unused-expressions -- used by codegen */
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { ChargeLink } from '@/components/common/buttons/charge-link.js';
import {
  GenerateBankDepositsRevaluationChargeDocument,
  GenerateDepreciationChargeDocument,
  GenerateRecoveryReserveChargeDocument,
  GenerateRevaluationChargeDocument,
  GenerateTaxExpensesChargeDocument,
  GenerateVacationReserveChargeDocument,
  type GenerateBankDepositsRevaluationChargeMutationVariables,
  type GenerateDepreciationChargeMutationVariables,
  type GenerateRecoveryReserveChargeMutationVariables,
  type GenerateRevaluationChargeMutationVariables,
  type GenerateTaxExpensesChargeMutationVariables,
  type GenerateVacationReserveChargeMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';
import {
  claimMutationCall,
  MUTATION_DEDUPE_WINDOW_MS,
  notifyDuplicateBlocked,
} from '../helpers/mutation-dedupe.js';

/* GraphQL */ `
  mutation GenerateRevaluationCharge($ownerId: UUID!, $date: TimelessDate!) {
    generateRevaluationCharge(ownerId: $ownerId, date: $date) {
      id
    }
  }
`;

/* GraphQL */ `
  mutation GenerateBankDepositsRevaluationCharge($ownerId: UUID!, $date: TimelessDate!) {
    generateBankDepositsRevaluationCharge(ownerId: $ownerId, date: $date) {
      id
    }
  }
`;

/* GraphQL */ `
  mutation GenerateTaxExpensesCharge($ownerId: UUID!, $date: TimelessDate!) {
    generateTaxExpensesCharge(ownerId: $ownerId, year: $date) {
      id
    }
  }
`;

/* GraphQL */ `
  mutation GenerateDepreciationCharge($ownerId: UUID!, $date: TimelessDate!) {
    generateDepreciationCharge(ownerId: $ownerId, year: $date) {
      id
    }
  }
`;

/* GraphQL */ `
  mutation GenerateRecoveryReserveCharge($ownerId: UUID!, $date: TimelessDate!) {
    generateRecoveryReserveCharge(ownerId: $ownerId, year: $date) {
      id
    }
  }
`;

/* GraphQL */ `
  mutation GenerateVacationReserveCharge($ownerId: UUID!, $date: TimelessDate!) {
    generateVacationReserveCharge(ownerId: $ownerId, year: $date) {
      id
    }
  }
`;

export enum FinancialChargeEnum {
  Revaluation = 'Revaluation',
  BankDeposits = 'BankDeposits',
  TaxExpenses = 'TaxExpenses',
  Depreciation = 'Depreciation',
  RecoveryReserve = 'RecoveryReserve',
  VacationReserve = 'VacationReserve',
}

type Variables<T extends FinancialChargeEnum> = {
  type: T;
} & (T extends FinancialChargeEnum.Revaluation
  ? GenerateRevaluationChargeMutationVariables
  : T extends FinancialChargeEnum.BankDeposits
    ? GenerateBankDepositsRevaluationChargeMutationVariables
    : T extends FinancialChargeEnum.TaxExpenses
      ? GenerateTaxExpensesChargeMutationVariables
      : T extends FinancialChargeEnum.Depreciation
        ? GenerateDepreciationChargeMutationVariables
        : T extends FinancialChargeEnum.RecoveryReserve
          ? GenerateRecoveryReserveChargeMutationVariables
          : T extends FinancialChargeEnum.VacationReserve
            ? GenerateVacationReserveChargeMutationVariables
            : never);

type UseGenerateFinancialCharge = {
  fetching: boolean;
  generateFinancialCharge: (variables: Variables<FinancialChargeEnum>) => Promise<boolean>;
};

const NOTIFICATION_ID = 'generateFinancialCharge';

/** Each type's own mutation document, which keys its dedupe guard. */
const FINANCIAL_CHARGE_DOCUMENTS: Record<FinancialChargeEnum, object> = {
  [FinancialChargeEnum.Revaluation]: GenerateRevaluationChargeDocument,
  [FinancialChargeEnum.BankDeposits]: GenerateBankDepositsRevaluationChargeDocument,
  [FinancialChargeEnum.TaxExpenses]: GenerateTaxExpensesChargeDocument,
  [FinancialChargeEnum.Depreciation]: GenerateDepreciationChargeDocument,
  [FinancialChargeEnum.RecoveryReserve]: GenerateRecoveryReserveChargeDocument,
  [FinancialChargeEnum.VacationReserve]: GenerateVacationReserveChargeDocument,
};

export const useGenerateFinancialCharge = (): UseGenerateFinancialCharge => {
  // TODO: add authentication
  // TODO: add local data update method after chang e

  const [{ fetching: fetchingRevaluationCharge }, mutateRevaluationCharge] = useMutation(
    GenerateRevaluationChargeDocument,
  );
  const [{ fetching: fetchingBankDepositsRevaluationCharge }, mutateBankDepositsRevaluationCharge] =
    useMutation(GenerateBankDepositsRevaluationChargeDocument);
  const [{ fetching: fetchingTaxExpensesCharge }, mutateTaxExpensesCharge] = useMutation(
    GenerateTaxExpensesChargeDocument,
  );
  const [{ fetching: fetchingDepreciationCharge }, mutateDepreciationCharge] = useMutation(
    GenerateDepreciationChargeDocument,
  );
  const [{ fetching: fetchingRecoveryReserveCharge }, mutateRecoveryReserveCharge] = useMutation(
    GenerateRecoveryReserveChargeDocument,
  );
  const [{ fetching: fetchingVacationReserveCharge }, mutateVacationReserveCharge] = useMutation(
    GenerateVacationReserveChargeDocument,
  );
  const fetching =
    fetchingRevaluationCharge ||
    fetchingBankDepositsRevaluationCharge ||
    fetchingTaxExpensesCharge ||
    fetchingDepreciationCharge ||
    fetchingRecoveryReserveCharge ||
    fetchingVacationReserveCharge;

  const generateFinancialCharge = useCallback(
    async (variablesAndType: Variables<FinancialChargeEnum>) => {
      const { type, ...variables } = variablesAndType;
      const message = `Error generating financial charge [${type}]`;
      const notificationId = `${NOTIFICATION_ID}-${type}`;

      // Every call inserts a new charge, with no check for an existing one, so a repeat is
      // blocked for the window. These mutations have no `CommonError` result: any failure may
      // have run, so the window is always kept.
      const release = claimMutationCall(
        FINANCIAL_CHARGE_DOCUMENTS[type],
        variables,
        MUTATION_DEDUPE_WINDOW_MS,
      );
      if (!release) {
        notifyDuplicateBlocked(notificationId);
        return false;
      }

      toast.loading('Generating financial charge', {
        id: notificationId,
      });

      let charge: { id: string } | undefined;
      try {
        switch (type) {
          case FinancialChargeEnum.Revaluation:
            charge = await mutateRevaluationCharge(variables).then(res => {
              const data = handleCommonErrors(res, message, notificationId);
              return data?.generateRevaluationCharge;
            });
            break;
          case FinancialChargeEnum.BankDeposits:
            charge = await mutateBankDepositsRevaluationCharge(variables).then(res => {
              const data = handleCommonErrors(res, message, notificationId);
              return data?.generateBankDepositsRevaluationCharge;
            });
            break;
          case FinancialChargeEnum.TaxExpenses:
            charge = await mutateTaxExpensesCharge(variables).then(res => {
              const data = handleCommonErrors(res, message, notificationId);
              return data?.generateTaxExpensesCharge;
            });
            break;
          case FinancialChargeEnum.Depreciation:
            charge = await mutateDepreciationCharge(variables).then(res => {
              const data = handleCommonErrors(res, message, notificationId);
              return data?.generateDepreciationCharge;
            });
            break;
          case FinancialChargeEnum.RecoveryReserve:
            charge = await mutateRecoveryReserveCharge(variables).then(res => {
              const data = handleCommonErrors(res, message, notificationId);
              return data?.generateRecoveryReserveCharge;
            });
            break;
          case FinancialChargeEnum.VacationReserve:
            charge = await mutateVacationReserveCharge(variables).then(res => {
              const data = handleCommonErrors(res, message, notificationId);
              return data?.generateVacationReserveCharge;
            });
            break;
          default:
            throw new Error(`Unknown financial charge type: ${type}`);
        }
        if (charge?.id) {
          toast.success('Success', {
            id: notificationId,
            description: ChargeLink({ chargeId: charge.id, label: `New ${type} charge created` }),
          });
          return true;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
        return false;
      } finally {
        release(true);
      }
      return false;
    },
    [
      mutateBankDepositsRevaluationCharge,
      mutateDepreciationCharge,
      mutateRecoveryReserveCharge,
      mutateRevaluationCharge,
      mutateTaxExpensesCharge,
      mutateVacationReserveCharge,
    ],
  );

  return {
    fetching,
    generateFinancialCharge,
  };
};
