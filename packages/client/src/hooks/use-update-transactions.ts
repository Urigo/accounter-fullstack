import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateTransactionsDocument,
  type UpdateTransactionsMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateTransactions($transactionIds: [UUID!]!, $fields: UpdateTransactionInput!) {
    updateTransactions(transactionIds: $transactionIds, fields: $fields) {
      __typename
      ... on UpdatedTransactionsSuccessfulResult {
        transactions {
          ... on Transaction {
            id
          }
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type UseUpdateTransactions = {
  fetching: boolean;
  updateTransactions: (variables: UpdateTransactionsMutationVariables) => Promise<string[] | void>;
};

const NOTIFICATION_ID = 'updateTransactions';

export const useUpdateTransactions = (): UseUpdateTransactions => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateTransactionsDocument);
  const updateTransactions = useCallback(
    async (variables: UpdateTransactionsMutationVariables) => {
      const stringIds = Array.isArray(variables.transactionIds)
        ? variables.transactionIds.join(', ')
        : variables.transactionIds;
      const message = `Error updating transactions ID [${stringIds}]`;
      const notificationId = `${NOTIFICATION_ID}-${stringIds}`;
      toast.loading('Updating Transactions', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateTransactions');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Transactions updated',
          });
          return data.updateTransactions.transactions.map(t => t.id /* map to only id */);
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
    updateTransactions,
  };
};
