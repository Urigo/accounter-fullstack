import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateTransactionDocument,
  type UpdateTransactionMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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
  } | void>;
};

const NOTIFICATION_ID = 'updateTransaction';

export const useUpdateTransaction = (): UseUpdateTransaction => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateTransactionDocument);
  const updateTransaction = useCallback(
    async (variables: UpdateTransactionMutationVariables) => {
      const message = `Error updating transaction ID [${variables.transactionId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.transactionId}`;
      toast.loading('Updating Transaction', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateTransaction');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Transaction updated',
          });
          return data.updateTransaction;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    updateTransaction,
  };
};
