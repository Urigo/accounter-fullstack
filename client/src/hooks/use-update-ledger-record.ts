import { gql } from 'graphql-tag';
import {
  UpdateLedgerRecordMutation,
  UpdateLedgerRecordMutationVariables,
  useUpdateLedgerRecordMutation,
} from '../__generated__/types.js';

gql`
  mutation UpdateLedgerRecord($ledgerRecordId: ID!, $fields: UpdateLedgerRecordInput!) {
    updateLedgerRecord(ledgerRecordId: $ledgerRecordId, fields: $fields) {
      __typename
      ... on LedgerRecord {
        id
      }
      ... on CommonError {
        message
      }
    }
  }
`;

export const useUpdateLedgerRecord = () => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const onError = async (e: unknown, { ledgerRecordId }: UpdateLedgerRecordMutationVariables) => {
    console.log(e);
    return new Error(`Error updating ledger record ID [${ledgerRecordId}]: ${(e as Error)?.message}`);
  };
  const onSuccess = async (data: UpdateLedgerRecordMutation) => {
    if (data.updateLedgerRecord.__typename === 'CommonError') {
      throw new Error(data.updateLedgerRecord.message);
    }
    return data.updateLedgerRecord;
  };
  return useUpdateLedgerRecordMutation({
    onError,
    onSuccess,
  });
};
