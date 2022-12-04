import { gql } from 'graphql-tag';
import {
  GenerateLedgerRecordsMutation,
  GenerateLedgerRecordsMutationVariables,
  useGenerateLedgerRecordsMutation,
} from '../__generated__/types.js';

gql`
  mutation GenerateLedgerRecords($chargeId: ID!) {
    generateLedgerRecords(chargeId: $chargeId) {
      __typename
      ... on Charge {
        id
        ledgerRecords {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

export const useGenerateLedgerRecords = () => {
  // TODO: add authentication
  // TODO: add local data update method after generate

  const onError = async (e: unknown, { chargeId }: GenerateLedgerRecordsMutationVariables) => {
    console.log(e);
    return new Error(
      `Error generating ledger record to charge ID [${chargeId}]: ${(e as Error)?.message}`,
    );
  };
  const onSuccess = async (data: GenerateLedgerRecordsMutation) => {
    if (data.generateLedgerRecords.__typename === 'CommonError') {
      throw new Error(data.generateLedgerRecords.message);
    }
    // TODO: if caching - update local data for charge
    return data.generateLedgerRecords;
  };
  return useGenerateLedgerRecordsMutation({
    onError,
    onSuccess,
  });
};
