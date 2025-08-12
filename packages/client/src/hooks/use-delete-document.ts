import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { DeleteDocumentDocument, type DeleteDocumentMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteDocument($documentId: UUID!) {
    deleteDocument(documentId: $documentId)
  }
`;

type UseDeleteDocument = {
  fetching: boolean;
  deleteDocument: (variables: DeleteDocumentMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'deleteDocument';

export const useDeleteDocument = (): UseDeleteDocument => {
  // TODO: add authentication
  // TODO: add local data delete method after change

  const [{ fetching }, mutate] = useMutation(DeleteDocumentDocument);
  const deleteDocument = useCallback(
    async (variables: DeleteDocumentMutationVariables) => {
      const message = `Error deleting document ID [${variables.documentId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.documentId}`;
      toast.loading('Deleting Document', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Document was deleted',
          });
          return data.deleteDocument;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return false;
    },
    [mutate],
  );

  return {
    fetching,
    deleteDocument,
  };
};
