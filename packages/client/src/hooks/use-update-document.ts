import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { graphql, ResultOf, VariablesOf } from '../graphql.js';

export const UpdateDocumentDocument = graphql(`
  mutation UpdateDocument($documentId: UUID!, $fields: UpdateDocumentFieldsInput!) {
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
`);

type UpdateDocumentMutationVariables = VariablesOf<typeof UpdateDocumentDocument>;
type UpdateDocumentMutation = ResultOf<typeof UpdateDocumentDocument>;

type UpdateDocumentSuccessfulResult = Extract<
  UpdateDocumentMutation['updateDocument'],
  { __typename: 'UpdateDocumentSuccessfulResult' }
>;

type UseUpdateDocument = {
  fetching: boolean;
  updateDocument: (
    variables: UpdateDocumentMutationVariables,
  ) => Promise<UpdateDocumentSuccessfulResult>;
};

export const useUpdateDocument = (): UseUpdateDocument => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateDocumentDocument);

  return {
    fetching,
    updateDocument: (
      variables: UpdateDocumentMutationVariables,
    ): Promise<UpdateDocumentSuccessfulResult> =>
      new Promise<UpdateDocumentSuccessfulResult>((resolve, reject) =>
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
