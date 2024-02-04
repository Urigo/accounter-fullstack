import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  FlagForeignFeeTransactionsDocument,
  MergeChargesByTransactionReferenceDocument,
} from '../gql/graphql.js';

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

  return {
    fetching: executingFlagFees || executingMergeCharges,
    executeJobs: (): Promise<void> =>
      new Promise<void>((resolve, reject) =>
        flagFees({}).then(res => {
          if (res.error) {
            console.error(`Error flagging foreign fee transactions: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data?.flagForeignFeeTransactions) {
            console.error('Error flagging foreign fee transactions');
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (!res.data.flagForeignFeeTransactions.success) {
            console.error(
              'Error flagging foreign fee transactions' + res.data.flagForeignFeeTransactions.errors
                ? ':\n' + res.data.flagForeignFeeTransactions.errors?.join('\n')
                : undefined,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.flagForeignFeeTransactions.errors);
          }
          showNotification({
            title: 'Fees flagged!',
            message: 'Foreign fee transactions were successfully tagged',
          });

          // eslint-disable-next-line promise/no-nesting
          mergeCharges({}).then(res => {
            if (res.error) {
              console.error(`Error auto-merging charges: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oh no!, we have an error! 🤥',
              });
              return reject(res.error.message);
            }
            if (!res.data?.mergeChargesByTransactionReference) {
              console.error('Error auto-merging charges');
              showNotification({
                title: 'Error!',
                message: 'Oh no!, we have an error! 🤥',
              });
              return reject('No data returned');
            }
            if (!res.data.mergeChargesByTransactionReference.success) {
              console.error(
                'Error auto-merging charges' + res.data.mergeChargesByTransactionReference.errors
                  ? ':\n' + res.data.mergeChargesByTransactionReference.errors?.join('\n')
                  : undefined,
              );
              showNotification({
                title: 'Error!',
                message: 'Oh no!, we have an error! 🤥',
              });
              return reject(res.data.mergeChargesByTransactionReference.errors);
            }
            showNotification({
              title: 'Charges merged!',
              message: 'Charges successfully auto-merged',
            });

            return resolve();
          });
        }),
      ),
  };
};
