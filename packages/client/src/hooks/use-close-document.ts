import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { CloseDocumentDocument, CloseDocumentMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CloseDocument($documentId: UUID!) {
    closeDocument(id: $documentId)
  }
`;

type UseCloseDocument = {
  fetching: boolean;
  closeDocument: (variables: CloseDocumentMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'closeDocument';

export const useCloseDocument = (): UseCloseDocument => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(CloseDocumentDocument);
  const closeDocument = useCallback(
    async (variables: CloseDocumentMutationVariables) => {
      const message = `Error closing document ID [${variables.documentId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.documentId}`;
      toast.loading('Closing Document...', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'closeDocument');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Document closed',
          });
          return data.closeDocument;
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
      return false;
    },
    [mutate],
  );

  return {
    fetching,
    closeDocument,
  };
};
