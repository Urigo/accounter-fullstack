import { gql } from 'graphql-tag';
import {
  DeleteDocumentMutation,
  DeleteDocumentMutationVariables,
  useDeleteDocumentMutation,
} from '../__generated__/types.js';

gql`
  mutation DeleteDocument($documentId: ID!) {
    deleteDocument(documentId: $documentId)
  }
`;

export const useDeleteDocument = () => {
  // TODO: add authentication
  // TODO: add local data delete method after change

  const onError = async (e: unknown, { documentId }: DeleteDocumentMutationVariables) => {
    console.error(e);
    return new Error(`Error deleting document ID [${documentId}]: ${(e as Error)?.message}`);
  };
  const onSuccess = async (data: DeleteDocumentMutation, { documentId }: DeleteDocumentMutationVariables) => {
    if (!data.deleteDocument) {
      throw new Error(`Error deleting document ID [${documentId}]`);
    }
    return data.deleteDocument;
  };
  return useDeleteDocumentMutation({
    onError,
    onSuccess,
  });
};
