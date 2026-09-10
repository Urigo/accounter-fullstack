import {
  UpdateTransactionDocument,
  type UpdateTransactionMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: UpdateTransactionDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.transactionId}`,
    loadingMessage: 'Updating Transaction',
    errorMessage: variables => `Error updating transaction ID [${variables.transactionId}]`,
    commonErrorPath: 'updateTransaction',
    select: data => data.updateTransaction,
    successToast: { description: 'Transaction updated' },
  });

  return {
    fetching,
    updateTransaction: execute,
  };
};
