import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  CalculateCreditcardTransactionsDebitDateDocument,
  FlagForeignFeeTransactionsDocument,
  MergeChargesByTransactionReferenceDocument,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation FlagForeignFeeTransactions {
    flagForeignFeeTransactions {
      success
      errors
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation MergeChargesByTransactionReference {
    mergeChargesByTransactionReference {
      success
      errors
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CalculateCreditcardTransactionsDebitDate {
    calculateCreditcardTransactionsDebitDate
  }
`;

const NOTIFICATION_ID = 'mergeChargesByTransactionReference';

type UseCornJobs = {
  fetching: boolean;
  executeJobs: () => Promise<void>;
};

export const useCornJobs = (): UseCornJobs => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching: executingFlagFees }, flagFees] = useMutation(
    FlagForeignFeeTransactionsDocument,
  );
  const [{ fetching: executingMergeCharges }, mergeCharges] = useMutation(
    MergeChargesByTransactionReferenceDocument,
  );
  const [{ fetching: executingCalculateDebitDates }, calculateDebitDates] = useMutation(
    CalculateCreditcardTransactionsDebitDateDocument,
  );
  const executeJobs = useCallback(async () => {
    let message = 'Error flagging foreign fee transactions';
    const feeNotificationId = `${NOTIFICATION_ID}-fees`;
    const mergeChargesNotificationId = `${NOTIFICATION_ID}-merge`;
    const calculateDebitDateNotificationId = `${NOTIFICATION_ID}-debit-date`;
    toast.loading('Flagging Fees', {
      id: feeNotificationId,
    });
    try {
      const flagFeesRes = await flagFees({});
      const flagFeesData = handleCommonErrors(flagFeesRes, message, feeNotificationId);
      if (!flagFeesData) {
        return void 0;
      }
      if (!flagFeesData.flagForeignFeeTransactions.success) {
        console.error(
          `${message} ${
            flagFeesData.flagForeignFeeTransactions.errors
              ? ':\n' + flagFeesData.flagForeignFeeTransactions.errors?.join('\n')
              : ''
          }`,
        );
        toast.error('Error', {
          id: feeNotificationId,
          description: message,
        });
        return void 0;
      }
      toast.success('Success', {
        id: feeNotificationId,
        description: 'Foreign fee transactions were successfully tagged',
      });

      // next task: auto merge charges
      message = 'Error auto-merging charges';
      toast.loading('Merging Charges', {
        id: mergeChargesNotificationId,
      });
      const mergeChargesRes = await mergeCharges({});
      const mergeChargesData = handleCommonErrors(
        mergeChargesRes,
        message,
        mergeChargesNotificationId,
      );
      if (!mergeChargesData) {
        return void 0;
      }
      if (!mergeChargesData.mergeChargesByTransactionReference.success) {
        console.error(
          `${message} ${
            mergeChargesData.mergeChargesByTransactionReference.errors
              ? ':\n' + mergeChargesData.mergeChargesByTransactionReference.errors?.join('\n')
              : ''
          }`,
        );
        toast.error('Error', {
          id: mergeChargesNotificationId,
          description: message,
        });
        return void 0;
      }
      toast.success('Success', {
        id: mergeChargesNotificationId,
        description: 'Charges successfully auto-merged',
      });

      // next task: calculate debit date where missing for credit card transactions
      message = 'Error calculating missing debit date for credit card transactions';
      toast.loading('Completing missing debit dates', {
        id: calculateDebitDateNotificationId,
      });
      const calculateDebitDatesRes = await calculateDebitDates({});
      const calculateDebitDatesData = handleCommonErrors(
        calculateDebitDatesRes,
        message,
        calculateDebitDateNotificationId,
      );
      if (!calculateDebitDatesData) {
        return void 0;
      }
      if (!calculateDebitDatesData.calculateCreditcardTransactionsDebitDate) {
        toast.error('Error', {
          id: calculateDebitDateNotificationId,
          description: message,
        });
        return void 0;
      }
      toast.success('Success', {
        id: calculateDebitDateNotificationId,
        description: 'Debit dates successfully updated',
      });
    } catch (e) {
      console.error(`${message}: ${e}`);
      toast.dismiss(feeNotificationId);
      toast.dismiss(mergeChargesNotificationId);
      toast.dismiss(calculateDebitDateNotificationId);

      toast.error('Error', {
        description: 'Error handling tasks',
        duration: 100_000,
        closeButton: true,
      });
    }
    return void 0;
  }, [flagFees, mergeCharges, calculateDebitDates]);

  return {
    fetching: executingFlagFees || executingMergeCharges || executingCalculateDebitDates,
    executeJobs,
  };
};
