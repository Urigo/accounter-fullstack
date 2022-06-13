import { gql } from 'graphql-tag';
import {
  UpdateTransactionMutation,
  UpdateTransactionMutationVariables,
  useUpdateTransactionMutation,
} from '../__generated__/types';

gql`
  mutation UpdateTransaction($transactionId: ID!, $fields: UpdateTransactionInput!) {
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

export const useUpdateTransaction = () => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const onError = async (e: unknown, { transactionId }: UpdateTransactionMutationVariables) => {
    console.log(e);
    return new Error(`Error updating charge ID [${transactionId}]: ${(e as Error)?.message}`);
  };
  const onSuccess = async (data: UpdateTransactionMutation) => {
    if (data.updateTransaction.__typename === 'CommonError') {
      throw new Error(data.updateTransaction.message);
    }
    return data.updateTransaction;
  };
  return useUpdateTransactionMutation({
    onError,
    onSuccess,
  });
};
