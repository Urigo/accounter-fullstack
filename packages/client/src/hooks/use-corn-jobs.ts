import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
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
  const executeJobs = useCallback(async () => {
    let message = 'Error flagging foreign fee transactions';
    const feeNotificationId = `${NOTIFICATION_ID}-fees`;
    const mergeChargesNotificationId = `${NOTIFICATION_ID}-merge`;
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
    } catch (e) {
      console.error(`${message}: ${e}`);
      toast.dismiss(feeNotificationId);
      toast.dismiss(mergeChargesNotificationId);
      toast.error('Error', {
        description: 'Error handling tasks',
        duration: 100_000,
        closeButton: true,
      });
    }
    return void 0;
  }, [flagFees, mergeCharges]);

  return {
    fetching: executingFlagFees || executingMergeCharges,
    executeJobs,
  };
};
