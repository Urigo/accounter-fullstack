import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { NewDocumentsList } from '../components/common/new-documents-list.jsx';
import {
  NewFetchedDocumentFieldsFragmentDoc,
  UploadDocumentsFromGoogleDriveDocument,
  UploadDocumentsFromGoogleDriveMutation,
  UploadDocumentsFromGoogleDriveMutationVariables,
} from '../gql/graphql.js';
import { FragmentType } from '../gql/index.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UploadDocumentsFromGoogleDrive(
    $sharedFolderUrl: String!
    $chargeId: UUID
    $isSensitive: Boolean
  ) {
    batchUploadDocumentsFromGoogleDrive(
      sharedFolderUrl: $sharedFolderUrl
      chargeId: $chargeId
      isSensitive: $isSensitive
    ) {
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

type UploadDocumentsFromGoogleDrive =
  UploadDocumentsFromGoogleDriveMutation['batchUploadDocumentsFromGoogleDrive'];

type UseUploadDocumentsFromGoogleDrive = {
  uploading: boolean;
  uploadDocumentsFromGoogleDrive: (
    variables: UploadDocumentsFromGoogleDriveMutationVariables,
  ) => Promise<UploadDocumentsFromGoogleDrive | void>;
};

const NOTIFICATION_ID = 'uploadDocumentsFromGoogleDrive';

export const useUploadDocumentsFromGoogleDrive = (): UseUploadDocumentsFromGoogleDrive => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching: uploading }, mutate] = useMutation(UploadDocumentsFromGoogleDriveDocument);
  const uploadDocumentsFromGoogleDrive = useCallback(
    async (variables: UploadDocumentsFromGoogleDriveMutationVariables) => {
      const message = 'Error uploading documents';
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      toast.loading('Uploading Documents', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(
          res,
          message,
          notificationId,
          'batchUploadDocumentsFromGoogleDrive',
        );
        if (data) {
          let hasError = false;
          const documents = (
            data.batchUploadDocumentsFromGoogleDrive.filter(singleRes => {
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
              UploadDocumentsFromGoogleDrive[number],
              { __typename?: 'UploadDocumentSuccessfulResult' }
            >[]
          ).map(
            ({ document }) => document as FragmentType<typeof NewFetchedDocumentFieldsFragmentDoc>,
          );
          toast.success('Upload Successful', {
            id: notificationId,
            description:
              documents.length > 0
                ? NewDocumentsList({ data: documents })
                : 'No successful document uploads',
            duration: documents.length > 0 ? Infinity : 5000,
            dismissible: true,
            closeButton: true,
          });
          if (hasError) {
            toast.error('Some files failed to upload', {
              duration: 100_000,
              closeButton: true,
            });
          }
          return documents as UploadDocumentsFromGoogleDrive;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: Infinity,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    uploading,
    uploadDocumentsFromGoogleDrive,
  };
};
