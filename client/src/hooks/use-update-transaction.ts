import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateTransactionDocument,
  UpdateTransactionMutation,
  UpdateTransactionMutationVariables,
} from '../gql/graphql.js';

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

export const useUpdateTransaction = (): UseUpdateTransaction => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateTransactionDocument);

  return {
    fetching,
    updateTransaction: (variables: UpdateTransactionMutationVariables): Promise<{ id: string }> =>
      new Promise<
        Extract<
          UpdateTransactionMutation['updateTransaction'],
          { __typename: 'CommonTransaction' | 'ConversionTransaction' }
        >
      >((resolve, reject) =>
        mutate(variables).then(res => {
          if ('error' in res && res.error) {
            console.error(
              `Error updating transaction ID [${variables.transactionId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error updating transaction ID [${variables.transactionId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.updateTransaction.__typename === 'CommonError') {
            console.error(
              `Error updating transaction ID [${variables.transactionId}]: ${res.data.updateTransaction.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.updateTransaction.message);
          }
          showNotification({
            title: 'Update Success!',
            message: 'Hey there, your update is awesome!',
          });
          return resolve(res.data.updateTransaction);
        }),
      ),
  };
};
