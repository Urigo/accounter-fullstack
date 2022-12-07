import { gql } from 'graphql-tag';
import {
  InsertDbLedgerRecordMutation,
  InsertDbLedgerRecordMutationVariables,
  useInsertDbLedgerRecordMutation,
} from '../__generated__/types.js';

gql`
  mutation InsertDbLedgerRecord($chargeId: ID!, $record: InsertDbLedgerRecordInput!) {
    insertDbLedgerRecord(chargeId: $chargeId, record: $record) {
      __typename
      ... on Charge {
        id
      }
      ... on CommonError {
        message
      }
    }
  }
`;

export const useInsertDbLedgerRecord = () => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const onError = async (e: unknown, { chargeId }: InsertDbLedgerRecordMutationVariables) => {
    console.log(e);
    return new Error(
      `Error inserting ledger record to charge ID [${chargeId}]: ${(e as Error)?.message}`,
    );
  };
  const onSuccess = async (data: InsertDbLedgerRecordMutation) => {
    if (data.insertDbLedgerRecord.__typename === 'CommonError') {
      throw new Error(data.insertDbLedgerRecord.message);
    }
    // TODO: if caching - update local data for charge
    return data.insertDbLedgerRecord;
  };
  return useInsertDbLedgerRecordMutation({
    onError,
    onSuccess,
  });
};
