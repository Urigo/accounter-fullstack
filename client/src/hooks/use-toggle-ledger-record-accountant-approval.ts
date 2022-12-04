import { gql } from 'graphql-tag';
import {
  ToggleLedgerRecordAccountantApprovalMutation,
  ToggleLedgerRecordAccountantApprovalMutationVariables,
  useToggleLedgerRecordAccountantApprovalMutation,
} from '../__generated__/types.js';

gql`
  mutation ToggleLedgerRecordAccountantApproval($ledgerRecordId: ID!, $approved: Boolean!) {
    toggleLedgerRecordAccountantApproval(ledgerRecordId: $ledgerRecordId, approved: $approved)
  }
`;

export const useToggleLedgerRecordAccountantApproval = () => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const onError = async (e: unknown, { ledgerRecordId }: ToggleLedgerRecordAccountantApprovalMutationVariables) => {
    console.log(e);
    return new Error(
      `Error updating accountant approval of ledger record ID [${ledgerRecordId}]: ${(e as Error)?.message}`
    );
  };
  const onSuccess = async (data: ToggleLedgerRecordAccountantApprovalMutation) => {
    return data.toggleLedgerRecordAccountantApproval;
  };
  return useToggleLedgerRecordAccountantApprovalMutation({
    onError,
    onSuccess,
  });
};
