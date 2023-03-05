import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateDocumentDocument,
  UpdateDocumentMutation,
  UpdateDocumentMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
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

  const [{ fetching }, mutate] = useMutation(UpdateDocumentDocument);

  return {
    fetching,
    updateDocument: (variables: UpdateDocumentMutationVariables) =>
      new Promise<
        Extract<
          UpdateDocumentMutation['updateDocument'],
          { __typename: 'UpdateDocumentSuccessfulResult' }
        >
      >((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error updating document ID [${variables.documentId}]: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(`Error updating document ID [${variables.documentId}]: No data returned`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.updateDocument.__typename === 'CommonError') {
            console.error(
              `Error updating document ID [${variables.documentId}]: ${res.data.updateDocument.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.updateDocument.message);
          }
          showNotification({
            title: 'Update Success!',
            message: 'Hey there, your update is awesome!',
          });
          return resolve(res.data.updateDocument);
        }),
      ),
  };
};
