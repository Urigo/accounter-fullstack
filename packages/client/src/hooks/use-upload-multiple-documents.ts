import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { NewDocumentsList } from '../components/common/new-documents-list.js';
import {
  NewFetchedDocumentFieldsFragmentDoc,
  UploadMultipleDocumentsDocument,
  UploadMultipleDocumentsMutation,
  UploadMultipleDocumentsMutationVariables,
} from '../gql/graphql.js';
import { FragmentType } from '../gql/index.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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
  ) => Promise<UploadMultipleDocuments | void>;
};

const NOTIFICATION_ID = 'uploadMultipleDocuments';

export const useUploadMultipleDocuments = (): UseUploadMultipleDocuments => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching: uploading }, mutate] = useMutation(UploadMultipleDocumentsDocument);
  const uploadMultipleDocuments = useCallback(
    async (variables: UploadMultipleDocumentsMutationVariables) => {
      const message = 'Error uploading documents';
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      toast.loading('Uploading Documents', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'batchUploadDocuments');
        if (data) {
          let hasError = false;
          const documents = (
            data.batchUploadDocuments.filter(singleRes => {
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
            ({ document }) => document as FragmentType<typeof NewFetchedDocumentFieldsFragmentDoc>,
          );
          toast.success('Upload Successful', {
            id: notificationId,
            description:
              documents.length > 0
                ? NewDocumentsList({ data: documents })
                : 'No successful document uploads',
            duration: documents.length > 0 ? Infinity : 5000,
            closeButton: true,
          });
          if (hasError) {
            toast.error('Some files failed to upload', {
              duration: 100_000,
              closeButton: true,
            });
          }
          return documents as UploadMultipleDocuments;
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
      return void 0;
    },
    [mutate],
  );

  return {
    uploading,
    uploadMultipleDocuments,
  };
};
