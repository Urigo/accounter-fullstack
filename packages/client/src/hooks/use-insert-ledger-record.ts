import {
  InsertLedgerRecordDocument,
  type InsertLedgerRecordMutation,
  type InsertLedgerRecordMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertLedgerRecord(
    $chargeId: UUID!
    $operation: LedgerRecordOperation!
    $input: LedgerRecordInput!
  ) {
    insertLedgerRecord(chargeId: $chargeId, operation: $operation, input: $input) {
      __typename
      ... on InsertLedgerRecordSuccessfulResult {
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

type InsertedLedgerRecord = Extract<
  InsertLedgerRecordMutation['insertLedgerRecord'],
  { __typename: 'InsertLedgerRecordSuccessfulResult' }
>;

type UseInsertLedgerRecord = {
  fetching: boolean;
  /** Resolves to the inserted record on success, or to nothing when the server rejected it. */
  insertLedgerRecord: (
    variables: InsertLedgerRecordMutationVariables,
  ) => Promise<InsertedLedgerRecord | void>;
};

const NOTIFICATION_ID = 'insertLedgerRecord';

export const useInsertLedgerRecord = (): UseInsertLedgerRecord => {
  const { fetching, execute } = useApiMutation({
    document: InsertLedgerRecordDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.chargeId}`,
    loadingMessage: 'Adding ledger record',
    errorMessage: variables => `Error adding a ledger record to charge [${variables.chargeId}]`,
    commonErrorPath: 'insertLedgerRecord',
    select: data => data.insertLedgerRecord,
    successToast: { description: 'Ledger record added' },
  });

  return {
    fetching,
    insertLedgerRecord: execute,
  };
};
