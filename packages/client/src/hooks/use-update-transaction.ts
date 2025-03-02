import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import {
  UpdateTransactionDocument,
  UpdateTransactionMutation,
  UpdateTransactionMutationVariables,
} from '../gql/graphql.js';
import { useHandleKnownErrors } from './use-handle-known-errors.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateTransaction($transactionId: UUID!, $fields: UpdateTransactionInput!) {
    updateTransaction(transactionId: $transactionId, fields: $fields) {
      __typename
      ... on Transaction {
        id
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type UseUpdateTransaction = {
  fetching: boolean;
  updateTransaction: (variables: UpdateTransactionMutationVariables) => Promise<{
    id: string;
  }>;
};

const NOTIFICATION_ID = 'updateTransaction';

export const useUpdateTransaction = (): UseUpdateTransaction => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateTransactionDocument);
  const { handleKnownErrors } = useHandleKnownErrors();

  return {
    fetching,
    updateTransaction: (variables: UpdateTransactionMutationVariables): Promise<{ id: string }> =>
      new Promise<
        Extract<
          UpdateTransactionMutation['updateTransaction'],
          { __typename: 'CommonTransaction' | 'ConversionTransaction' }
        >
      >((resolve, reject) => {
        const notificationId = `${NOTIFICATION_ID}-${variables.transactionId}`;
        notifications.show({
          id: notificationId,
          loading: true,
          title: 'Updating Transaction',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        return mutate(variables).then(res => {
          const message = `Error updating transaction ID [${variables.transactionId}]`;
          const data = handleKnownErrors(res, reject, message, notificationId);
          if (!data) {
            return;
          }
          if (data.updateTransaction.__typename === 'CommonError') {
            console.error(`${message}: ${data.updateTransaction.message}`);
            notifications.update({
              id: notificationId,
              message,
              color: 'red',
              autoClose: 5000,
            });
            return reject(data.updateTransaction.message);
          }
          notifications.update({
            id: notificationId,
            title: 'Update Successful!',
            autoClose: 5000,
            message: 'Transaction updated',
            withCloseButton: true,
          });
          return resolve(data.updateTransaction);
        });
      }),
  };
};
