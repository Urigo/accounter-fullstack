import { gql } from 'graphql-tag';
import {
  InsertLedgerRecordMutation,
  InsertLedgerRecordMutationVariables,
  useInsertLedgerRecordMutation,
} from '../__generated__/types.js';

gql`
  mutation InsertLedgerRecord($chargeId: ID!, $record: InsertLedgerRecordInput!) {
    insertLedgerRecord(chargeId: $chargeId, record: $record) {
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

export const useInsertLedgerRecord = () => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const onError = async (e: unknown, { chargeId }: InsertLedgerRecordMutationVariables) => {
    console.log(e);
    return new Error(
      `Error inserting ledger record to charge ID [${chargeId}]: ${(e as Error)?.message}`,
    );
  };
  const onSuccess = async (data: InsertLedgerRecordMutation) => {
    if (data.insertLedgerRecord.__typename === 'CommonError') {
      throw new Error(data.insertLedgerRecord.message);
    }
    // TODO: if caching - update local data for charge
    return data.insertLedgerRecord;
  };
  return useInsertLedgerRecordMutation({
    onError,
    onSuccess,
  });
};
