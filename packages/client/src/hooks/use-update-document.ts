import {
  UpdateDocumentDocument,
  type UpdateDocumentMutation,
  type UpdateDocumentMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
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
        deletedChargeId
      }
    }
  }
`;

type UpdateDocumentSuccessfulResult = Extract<
  UpdateDocumentMutation['updateDocument'],
  { __typename: 'UpdateDocumentSuccessfulResult' }
>;

type UseUpdateDocument = {
  fetching: boolean;
  updateDocument: (
    variables: UpdateDocumentMutationVariables,
  ) => Promise<UpdateDocumentSuccessfulResult | void>;
};

const NOTIFICATION_ID = 'updateDocument';

export const useUpdateDocument = (): UseUpdateDocument => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: UpdateDocumentDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.documentId}`,
    loadingMessage: 'Updating document',
    errorMessage: variables => `Error updating document ID [${variables.documentId}]`,
    commonErrorPath: 'updateDocument',
    select: data => data.updateDocument,
    successToast: { description: 'Document updated' },
  });

  return {
    fetching,
    updateDocument: execute,
  };
};
