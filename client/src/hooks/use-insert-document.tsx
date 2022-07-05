import { gql } from 'graphql-tag';

import {
  InsertDocumentMutation,
  InsertDocumentMutationVariables,
  useInsertDocumentMutation,
} from '../__generated__/types';

gql`
  mutation InsertDocument($chargeId: ID!, $record: InsertDocumentInput!) {
    insertDocument(chargeId: $chargeId, record: $record) {
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

export const useInsertDocument = () => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const onError = async (e: unknown, { chargeId }: InsertDocumentMutationVariables) => {
    console.log(e);
    return new Error(`Error inserting ledger record to charge ID [${chargeId}]: ${(e as Error)?.message}`);
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
