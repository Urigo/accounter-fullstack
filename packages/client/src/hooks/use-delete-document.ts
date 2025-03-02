import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import { DeleteDocumentDocument, DeleteDocumentMutationVariables } from '../gql/graphql.js';
import { useHandleKnownErrors } from './use-handle-known-errors.js';

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
  const { handleKnownErrors } = useHandleKnownErrors();

  return {
    fetching,
    deleteDocument: (variables: DeleteDocumentMutationVariables): Promise<boolean> => {
      const notificationId = `${NOTIFICATION_ID}-${variables.documentId}`;
      return new Promise<boolean>((resolve, reject) => {
        notifications.show({
          id: notificationId,
          loading: true,
          title: 'Regenerating Ledger',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        return mutate(variables).then(res => {
          const message = `Error deleting document ID [${variables.documentId}]`;
          const data = handleKnownErrors(res, reject, message, notificationId);
          if (!data) {
            return;
          }
          if (data.deleteDocument === false) {
            console.error(message);
            notifications.update({
              id: notificationId,
              message,
              color: 'red',
              autoClose: 5000,
            });
            return reject(data.deleteDocument);
          }
          notifications.update({
            id: notificationId,
            title: 'Deletion Successful!',
            autoClose: 5000,
            message: 'Document was deleted',
            withCloseButton: true,
          });
          resolve(data.deleteDocument);
        });
      });
    },
  };
};
