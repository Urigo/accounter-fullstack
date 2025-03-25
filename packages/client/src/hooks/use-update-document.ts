import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateDocumentDocument,
  UpdateDocumentMutation,
  UpdateDocumentMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(UpdateDocumentDocument);
  const updateDocument = useCallback(
    async (variables: UpdateDocumentMutationVariables) => {
      const message = `Error updating document ID [${variables.documentId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.documentId}`;
      toast.loading('Updating document', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateDocument');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Document updated',
          });
          return data.updateDocument;
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
    fetching,
    updateDocument,
  };
};
