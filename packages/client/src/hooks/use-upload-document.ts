import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UploadDocumentDocument,
  UploadDocumentMutation,
  UploadDocumentMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UploadDocument($file: FileScalar!, $chargeId: UUID) {
    uploadDocument(file: $file, chargeId: $chargeId) {
      __typename
      ... on UploadDocumentSuccessfulResult {
        document {
          id
          charge {
            id
          }
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type UploadDocumentSuccessfulResult = Extract<
  UploadDocumentMutation['uploadDocument'],
  { __typename: 'UploadDocumentSuccessfulResult' }
>;

type UseUploadDocument = {
  fetching: boolean;
  uploadDocument: (
    variables: UploadDocumentMutationVariables,
  ) => Promise<UploadDocumentSuccessfulResult>;
};

export const useUploadDocument = (): UseUploadDocument => {
  // TODO: add authentication
  // TODO: add local data update method after upload

  const [{ fetching }, mutate] = useMutation(UploadDocumentDocument);

  return {
    fetching,
    uploadDocument: (
      variables: UploadDocumentMutationVariables,
    ): Promise<UploadDocumentSuccessfulResult> =>
      new Promise<UploadDocumentSuccessfulResult>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error uploading document to charge ID [${variables.chargeId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error uploading document to charge ID [${variables.chargeId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.uploadDocument.__typename === 'CommonError') {
            console.error(
              `Error uploading document to charge ID [${variables.chargeId}]: ${res.data.uploadDocument.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.uploadDocument.message);
          }
          showNotification({
            title: 'Upload Success!',
            message: 'Your document was added! 🎉',
          });
          return resolve(res.data.uploadDocument);
        }),
      ),
  };
};
