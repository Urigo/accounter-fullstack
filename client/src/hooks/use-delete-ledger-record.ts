import { gql } from 'graphql-tag';
import {
  DeleteLedgerRecordMutation,
  DeleteLedgerRecordMutationVariables,
  useDeleteLedgerRecordMutation,
} from '../__generated__/types.js';

gql`
  mutation DeleteLedgerRecord($ledgerRecordId: ID!) {
    deleteLedgerRecord(ledgerRecordId: $ledgerRecordId)
  }
`;

export const useDeleteLedgerRecord = () => {
  // TODO: add authentication
  // TODO: add local data delete method after change

  const onError = async (e: unknown, { ledgerRecordId }: DeleteLedgerRecordMutationVariables) => {
    console.error(e);
    return new Error(
      `Error deleting ledger record ID [${ledgerRecordId}]: ${(e as Error)?.message}`,
    );
  };
  const onSuccess = async (
    data: DeleteLedgerRecordMutation,
    { ledgerRecordId }: DeleteLedgerRecordMutationVariables,
  ) => {
    if (!data.deleteLedgerRecord) {
      throw new Error(`Error deleting ledger record ID [${ledgerRecordId}]`);
    }
    return data.deleteLedgerRecord;
  };
  return useDeleteLedgerRecordMutation({
    onError,
    onSuccess,
  });
};
