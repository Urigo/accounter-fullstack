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
    select: data =>
      (
        data.batchUploadDocuments.filter(
          singleRes => !('message' in singleRes) && 'document' in singleRes,
        ) as Extract<
          UploadMultipleDocuments[number],
          { __typename?: 'UploadDocumentSuccessfulResult' }
        >[]
      ).map(({ document }) => document as FragmentType<typeof NewFetchedDocumentFieldsFragmentDoc>),
    successToast: documents => ({
      title: 'Upload Successful',
      description:
        documents.length > 0
          ? NewDocumentsList({ data: documents })
          : 'No successful document uploads',
      duration: documents.length > 0 ? Infinity : 5000,
      closeButton: true,
    }),
    // A per-file failure doesn't fail the batch, so it gets a toast of its own — raised after the
    // success notification, so sonner stacks it in front rather than behind.
    onSuccess: (_documents, _variables, data) => {
      const failures = data.batchUploadDocuments.filter(singleRes => 'message' in singleRes);
      if (failures.length === 0) {
        return;
      }
      for (const failure of failures) {
        console.error(`Error uploading document: ${failure.message}`);
      }
      toast.error('Some files failed to upload', {
        duration: 100_000,
        closeButton: true,
      });
    },
  });

  return {
    uploading,
    uploadMultipleDocuments: execute,
  };
};
