import { toast } from 'sonner';
import { NewDocumentsList } from '../components/common/new-documents-list.js';
import {
  UploadMultipleDocumentsDocument,
  type NewFetchedDocumentFieldsFragmentDoc,
  type UploadMultipleDocumentsMutation,
  type UploadMultipleDocumentsMutationVariables,
} from '../gql/graphql.js';
import type { FragmentType } from '../gql/index.js';
import { useApiMutation } from './use-api-mutation.js';

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

/** The documents that actually uploaded — per-file failures are dropped from the batch. */
type UploadedDocuments = FragmentType<typeof NewFetchedDocumentFieldsFragmentDoc>[];

type UseUploadMultipleDocuments = {
  uploading: boolean;
  uploadMultipleDocuments: (
    variables: UploadMultipleDocumentsMutationVariables,
  ) => Promise<UploadedDocuments | void>;
};

const NOTIFICATION_ID = 'uploadMultipleDocuments';

export const useUploadMultipleDocuments = (): UseUploadMultipleDocuments => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching: uploading, execute } = useApiMutation({
    document: UploadMultipleDocumentsDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.chargeId}`,
    loadingMessage: 'Uploading Documents',
    errorMessage: 'Error uploading documents',
    commonErrorPath: 'batchUploadDocuments',
    select: data => {
      let hasError = false;
      const documents = (
        data.batchUploadDocuments.filter(singleRes => {
          if ('message' in singleRes) {
            console.error(`Error uploading document: ${singleRes.message}`);
            hasError = true;
            return false;
          }
          return 'document' in singleRes;
        }) as Extract<
          UploadMultipleDocuments[number],
          { __typename?: 'UploadDocumentSuccessfulResult' }
        >[]
      ).map(({ document }) => document as FragmentType<typeof NewFetchedDocumentFieldsFragmentDoc>);

      // A per-file failure doesn't fail the batch, so it gets a toast of its own alongside the
      // hook's success notification rather than replacing it.
      if (hasError) {
        toast.error('Some files failed to upload', {
          duration: 100_000,
          closeButton: true,
        });
      }

      return documents;
    },
    successToast: documents => ({
      title: 'Upload Successful',
      description:
        documents.length > 0
          ? NewDocumentsList({ data: documents })
          : 'No successful document uploads',
      duration: documents.length > 0 ? Infinity : 5000,
      closeButton: true,
    }),
  });

  return {
    uploading,
    uploadMultipleDocuments: execute,
  };
};
