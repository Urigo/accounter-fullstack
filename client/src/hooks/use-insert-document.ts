import { gql } from 'graphql-tag';
import {
  InsertDocumentMutation,
  InsertDocumentMutationVariables,
  useInsertDocumentMutation,
} from '../__generated__/types.js';

gql`
  mutation InsertDocument($record: InsertDocumentInput!) {
    insertDocument(record: $record) {
      __typename
      ... on InsertDocumentSuccessfulResult {
        document {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

export const useInsertDocument = () => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const onError = async (e: unknown, { record }: InsertDocumentMutationVariables) => {
    console.log(e);
    return new Error(`Error inserting ledger record to charge ID [${record.chargeId}]: ${(e as Error)?.message}`);
  };
  const onSuccess = async (data: InsertDocumentMutation) => {
    if (data.insertDocument.__typename === 'CommonError') {
      throw new Error(data.insertDocument.message);
    }
    // TODO: if caching - update local data for charge
    return data.insertDocument;
  };
  return useInsertDocumentMutation({
    onError,
    onSuccess,
  });
};
