import { gql } from 'graphql-tag';
import {
  UpdateDocumentMutation,
  UpdateDocumentMutationVariables,
  useUpdateDocumentMutation,
} from '../__generated__/types.js';

gql`
  mutation UpdateDocument($documentId: ID!, $fields: UpdateDocumentFieldsInput!) {
    updateDocument(documentId: $documentId, fields: $fields) {
      __typename
      ... on CommonError {
        message
      }
      ... on UpdateDocumentSuccessfulResult {
        document {
          id
        }
      }
    }
  }
`;

export const useUpdateDocument = () => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const onError = async (e: unknown, { documentId }: UpdateDocumentMutationVariables) => {
    console.log(e);
    return new Error(`Error updating charge ID [${documentId}]: ${(e as Error)?.message}`);
  };
  const onSuccess = async (data: UpdateDocumentMutation) => {
    if (data.updateDocument.__typename === 'CommonError') {
      throw new Error(data.updateDocument.message);
    }
    return data.updateDocument;
  };
  return useUpdateDocumentMutation({
    onError,
    onSuccess,
  });
};
