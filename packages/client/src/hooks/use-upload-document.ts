import {
  UploadDocumentDocument,
  type UploadDocumentMutation,
  type UploadDocumentMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  ) => Promise<UploadDocumentSuccessfulResult | void>;
};

const NOTIFICATION_ID = 'uploadDocument';

export const useUploadDocument = (): UseUploadDocument => {
  // TODO: add authentication
  // TODO: add local data update method after upload

  const { fetching, execute } = useApiMutation({
    document: UploadDocumentDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.chargeId}`,
    loadingMessage: 'Uploading Document',
    errorMessage: variables =>
      variables.chargeId
        ? `Error uploading document to charge ID [${variables.chargeId}]`
        : 'Error uploading document',
    commonErrorPath: 'uploadDocument',
    select: data => data.uploadDocument,
    successToast: { description: 'Document was added' },
  });

  return {
    fetching,
    uploadDocument: execute,
  };
};
