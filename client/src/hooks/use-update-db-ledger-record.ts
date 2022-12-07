import { gql } from 'graphql-tag';
import {
  UpdateDbLedgerRecordMutation,
  UpdateDbLedgerRecordMutationVariables,
  useUpdateDbLedgerRecordMutation,
} from '../__generated__/types.js';

gql`
  mutation UpdateDbLedgerRecord($ledgerRecordId: ID!, $fields: UpdateDbLedgerRecordInput!) {
    updateDbLedgerRecord(ledgerRecordId: $ledgerRecordId, fields: $fields) {
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

export const useUpdateDbLedgerRecord = () => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const onError = async (e: unknown, { ledgerRecordId }: UpdateDbLedgerRecordMutationVariables) => {
    console.log(e);
    return new Error(
      `Error updating ledger record ID [${ledgerRecordId}]: ${(e as Error)?.message}`,
    );
  };
  const onSuccess = async (data: UpdateDbLedgerRecordMutation) => {
    if (data.updateDbLedgerRecord.__typename === 'CommonError') {
      throw new Error(data.updateDbLedgerRecord.message);
    }
    return data.updateDbLedgerRecord;
  };
  return useUpdateDbLedgerRecordMutation({
    onError,
    onSuccess,
  });
};
