import {
  UpdateTransactionsDocument,
  type UpdateTransactionsMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

const joinIds = (transactionIds: UpdateTransactionsMutationVariables['transactionIds']): string =>
  Array.isArray(transactionIds) ? transactionIds.join(', ') : transactionIds;

export const useUpdateTransactions = (): UseUpdateTransactions => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: UpdateTransactionsDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${joinIds(variables.transactionIds)}`,
    loadingMessage: 'Updating Transactions',
    errorMessage: variables =>
      `Error updating transactions ID [${joinIds(variables.transactionIds)}]`,
    commonErrorPath: 'updateTransactions',
    select: data => data.updateTransactions.transactions.map(t => t.id /* map to only id */),
    successToast: { description: 'Transactions updated' },
  });

  return {
    fetching,
    updateTransactions: execute,
  };
};
