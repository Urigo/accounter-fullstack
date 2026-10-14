import {
  UpdateLedgerRecordDocument,
  type UpdateLedgerRecordMutation,
  type UpdateLedgerRecordMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateLedgerRecord($ledgerRecordId: UUID!, $input: LedgerRecordInput!) {
    updateLedgerRecord(ledgerRecordId: $ledgerRecordId, input: $input) {
      __typename
      ... on UpdateLedgerRecordSuccessfulResult {
        record {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type UpdatedLedgerRecord = Extract<
  UpdateLedgerRecordMutation['updateLedgerRecord'],
  { __typename: 'UpdateLedgerRecordSuccessfulResult' }
>;

type UseUpdateLedgerRecord = {
  fetching: boolean;
  /** Resolves to the updated record on success, or to nothing when the server rejected it. */
  updateLedgerRecord: (
    variables: UpdateLedgerRecordMutationVariables,
  ) => Promise<UpdatedLedgerRecord | void>;
};

const NOTIFICATION_ID = 'updateLedgerRecord';

export const useUpdateLedgerRecord = (): UseUpdateLedgerRecord => {
  const { fetching, execute } = useApiMutation({
    document: UpdateLedgerRecordDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.ledgerRecordId}`,
    loadingMessage: 'Updating ledger record',
    errorMessage: variables => `Error updating ledger record [${variables.ledgerRecordId}]`,
    commonErrorPath: 'updateLedgerRecord',
    select: data => data.updateLedgerRecord,
    successToast: { description: 'Ledger record updated' },
  });

  return {
    fetching,
    updateLedgerRecord: execute,
  };
};
