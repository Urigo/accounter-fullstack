import {
  DeleteDocumentDocument,
  type DeleteDocumentMutation,
  type DeleteDocumentMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteDocument($documentId: UUID!) {
    deleteDocument(documentId: $documentId) {
      success
      chargeId
      deletedChargeId
    }
  }
`;

type DeleteDocumentResult = DeleteDocumentMutation['deleteDocument'];

type UseDeleteDocument = {
  fetching: boolean;
  deleteDocument: (
    variables: DeleteDocumentMutationVariables,
  ) => Promise<DeleteDocumentResult | void>;
};

const NOTIFICATION_ID = 'deleteDocument';

export const useDeleteDocument = (): UseDeleteDocument => {
  // TODO: add authentication
  // TODO: add local data delete method after change

  const { fetching, execute } = useApiMutation({
    document: DeleteDocumentDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.documentId}`,
    loadingMessage: 'Deleting Document',
    errorMessage: variables => `Error deleting document ID [${variables.documentId}]`,
    select: data => {
      if (data.deleteDocument.success === false) {
        throw new Error('Unsuccessful deletion');
      }
      return data.deleteDocument;
    },
    successToast: result => ({
      description: result.deletedChargeId
        ? 'Document was deleted, along with its now-empty charge'
        : 'Document was deleted',
    }),
  });

  return {
    fetching,
    deleteDocument: execute,
  };
};
