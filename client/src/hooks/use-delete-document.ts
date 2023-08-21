import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { DeleteDocumentDocument, DeleteDocumentMutationVariables } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteDocument($documentId: ID!) {
    deleteDocument(documentId: $documentId)
  }
`;

type UseDeleteDocument = {
  fetching: boolean;
  deleteDocument: (variables: DeleteDocumentMutationVariables) => Promise<boolean>;
};

export const useDeleteDocument = (): UseDeleteDocument => {
  // TODO: add authentication
  // TODO: add local data delete method after change

  const [{ fetching }, mutate] = useMutation(DeleteDocumentDocument);

  return {
    fetching,
    deleteDocument: (variables: DeleteDocumentMutationVariables): Promise<boolean> =>
      new Promise<boolean>((resolve, reject) => {
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error deleting document ID [${variables.documentId}]: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(`Error deleting document ID [${variables.documentId}]: No data returned`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.deleteDocument === false) {
            console.error(
              `Error deleting document ID [${variables.documentId}]: Received 'false' from server`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject("Received 'false' from server");
          }
          showNotification({
            title: 'Deletion Success!',
            message: 'Document was deleted successfully! 🎉',
          });
          resolve(res.data.deleteDocument);
        });
      }),
  };
};
