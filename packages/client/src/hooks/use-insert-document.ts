import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  InsertDocumentDocument,
  InsertDocumentMutation,
  InsertDocumentMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
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

type InsertDocumentSuccessfulResult = Extract<
  InsertDocumentMutation['insertDocument'],
  { __typename: 'InsertDocumentSuccessfulResult' }
>;

type UseInsertDocument = {
  fetching: boolean;
  insertDocument: (
    variables: InsertDocumentMutationVariables,
  ) => Promise<InsertDocumentSuccessfulResult>;
};

export const useInsertDocument = (): UseInsertDocument => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertDocumentDocument);

  return {
    fetching,
    insertDocument: (
      variables: InsertDocumentMutationVariables,
    ): Promise<InsertDocumentSuccessfulResult> =>
      new Promise<InsertDocumentSuccessfulResult>((resolve, reject) =>
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
