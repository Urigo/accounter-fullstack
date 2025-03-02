import { useCallback } from 'react';
import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import {
  FlagForeignFeeTransactionsDocument,
  MergeChargesByTransactionReferenceDocument,
} from '../gql/graphql.js';
import { useHandleKnownErrors } from './use-handle-known-errors.js';

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
  const { handleKnownErrors } = useHandleKnownErrors();

  const executeJobs = useCallback(async (): Promise<void> => {
    let notificationId = `${NOTIFICATION_ID}-fees`;
    return new Promise<void>((resolve, reject) => {
      notifications.show({
        id: notificationId,
        loading: true,
        title: 'Flagging Fees',
        message: 'Please wait...',
        autoClose: false,
        withCloseButton: true,
      });

      return flagFees({}).then(res => {
        const message = 'Error flagging foreign fee transactions';
        const data = handleKnownErrors(res, reject, message, notificationId);
        if (!data) {
          return;
        }
        if (!data.flagForeignFeeTransactions.success) {
          console.error(
            `${message} ${
              data.flagForeignFeeTransactions.errors
                ? ':\n' + data.flagForeignFeeTransactions.errors?.join('\n')
                : ''
            }`,
          );
          notifications.update({
            id: notificationId,
            message,
            color: 'red',
            autoClose: 5000,
          });
          return reject(data.flagForeignFeeTransactions.errors);
        }
        notifications.update({
          id: notificationId,
          title: 'Fees flagged!',
          autoClose: 5000,
          message: 'Foreign fee transactions were successfully tagged',
          withCloseButton: true,
        });

        // next task: auto merge charges
        notificationId = `${NOTIFICATION_ID}-merge`;
        notifications.show({
          id: notificationId,
          loading: true,
          title: 'Merging Charges',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });
        // eslint-disable-next-line promise/no-nesting
        mergeCharges({}).then(res => {
          const message = 'Error auto-merging charges';
          const data = handleKnownErrors(res, reject, message, notificationId);
          if (!data) {
            return;
          }
          if (!data.mergeChargesByTransactionReference.success) {
            console.error(
              `${message} ${
                data.mergeChargesByTransactionReference.errors
                  ? ':\n' + data.mergeChargesByTransactionReference.errors?.join('\n')
                  : ''
              }`,
            );
            notifications.update({
              id: notificationId,
              message,
              color: 'red',
              autoClose: 5000,
            });
            return reject(data.mergeChargesByTransactionReference.errors);
          }
          notifications.update({
            id: notificationId,
            title: 'Charges merged!',
            autoClose: 5000,
            message: 'Charges successfully auto-merged',
            withCloseButton: true,
          });

          return resolve();
        });
      });
    });
  }, [flagFees, mergeCharges, handleKnownErrors]);

  return {
    fetching: executingFlagFees || executingMergeCharges,
    executeJobs,
  };
};
