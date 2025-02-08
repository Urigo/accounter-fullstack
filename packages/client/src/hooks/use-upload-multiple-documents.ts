import { useMutation } from 'urql';
import { notifications, showNotification } from '@mantine/notifications';
import { NewDocumentsList } from '../components/common/new-documents-list.js';
import {
  NewFetchedDocumentFieldsFragmentDoc,
  UploadMultipleDocumentsDocument,
  UploadMultipleDocumentsMutation,
  UploadMultipleDocumentsMutationVariables,
} from '../gql/graphql.js';
import { FragmentType } from '../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UploadMultipleDocuments(
    $documents: [FileScalar!]!
    $chargeId: UUID
    $isSensitive: Boolean
  ) {
    batchUploadDocuments(documents: $documents, chargeId: $chargeId, isSensitive: $isSensitive) {
      ... on CommonError {
        message
      }
      ... on UploadDocumentSuccessfulResult {
        document {
          id
          ...NewFetchedDocumentFields
        }
      }
    }
  }
`;

type UploadMultipleDocuments = UploadMultipleDocumentsMutation['batchUploadDocuments'];

type UseUploadMultipleDocuments = {
  uploading: boolean;
  uploadMultipleDocuments: (
    variables: UploadMultipleDocumentsMutationVariables,
  ) => Promise<UploadMultipleDocuments>;
};

const NOTIFICATION_ID = 'uploadMultipleDocuments';

export const useUploadMultipleDocuments = (): UseUploadMultipleDocuments => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching: uploading }, mutate] = useMutation(UploadMultipleDocumentsDocument);

  return {
    uploading,
    uploadMultipleDocuments: (
      variables: UploadMultipleDocumentsMutationVariables,
    ): Promise<UploadMultipleDocuments> =>
      new Promise<UploadMultipleDocuments>((resolve, reject) => {
        notifications.show({
          id: NOTIFICATION_ID,
          loading: true,
          title: 'Uploading Documents',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        return mutate(variables)
          .then(res => {
            if (res.error) {
              const message = 'Error uploading documents';
              console.error(`${message}: ${res.error}`);
              notifications.update({
                id: NOTIFICATION_ID,
                message,
                color: 'red',
                autoClose: 5000,
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error uploading documents: No data returned');
              notifications.update({
                id: NOTIFICATION_ID,
                title: 'Error uploading documents',
                message: 'No data returned',
                color: 'red',
                autoClose: 5000,
              });
              return reject('No data returned');
            }

            let hasError = false;
            const documents = (
              res.data.batchUploadDocuments.filter(singleRes => {
                if ('message' in singleRes) {
                  console.error(`Error uploading document: ${singleRes.message}`);
                  hasError = true;
                  return false;
                }
                if (!('document' in singleRes)) {
                  return false;
                }
                return true;
              }) as Extract<
                UploadMultipleDocuments[number],
                { __typename?: 'UploadDocumentSuccessfulResult' }
              >[]
            ).map(
              ({ document }) =>
                document as FragmentType<typeof NewFetchedDocumentFieldsFragmentDoc>,
            );
            notifications.update({
              id: NOTIFICATION_ID,
              title: 'Upload Successful!',
              autoClose: documents.length > 0 ? false : 5000,
              message:
                documents.length > 0
                  ? NewDocumentsList({ data: documents })
                  : 'No successful document uploads',
              withCloseButton: true,
            });
            if (hasError) {
              showNotification({
                message: 'Some files failed to upload',
                color: 'red',
                autoClose: 5000,
              });
            }
            return resolve(documents as UploadMultipleDocuments);
          })
          .catch(() => {
            notifications.update({
              id: NOTIFICATION_ID,
              title: 'Error!',
              message: 'An unexpected error occurred while uploading documents.',
              color: 'red',
              autoClose: 5000,
            });
          });
      }),
  };
};
