import { showNotification } from '@mantine/notifications';
import { useMutation } from 'urql';
import {
  InsertDocumentDocument,
  InsertDocumentMutation,
  InsertDocumentMutationVariables,
} from '../gql/graphql.js';

/* GraphQL */ `
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

  const [{ fetching }, mutate] = useMutation(InsertDocumentDocument);

  return {
    fetching,
    insertDocument: (variables: InsertDocumentMutationVariables) =>
      new Promise<
        Extract<
          InsertDocumentMutation['insertDocument'],
          { __typename: 'InsertDocumentSuccessfulResult' }
        >
      >((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error inserting document to charge ID [${variables.record.chargeId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error inserting document to charge ID [${variables.record.chargeId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.insertDocument.__typename === 'CommonError') {
            console.error(
              `Error inserting document to charge ID [${variables.record.chargeId}]: ${res.data.insertDocument.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.insertDocument.message);
          }
          showNotification({
            title: 'Insert Success!',
            message: 'Your document was added! 🎉',
          });
          return resolve(res.data.insertDocument);
        }),
      ),
  };
};
