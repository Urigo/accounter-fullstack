import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  DeleteDocumentDocument,
  type DeleteDocumentMutation,
  type DeleteDocumentMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteDocument($documentId: UUID!) {
    deleteDocument(documentId: $documentId) {
      success
      chargeId
      deletedChargeId
    }
  }
`;

type DeleteDocumentResult = DeleteDocumentMutation['deleteDocument'];

type UseDeleteDocument = {
  fetching: boolean;
  deleteDocument: (
    variables: DeleteDocumentMutationVariables,
  ) => Promise<DeleteDocumentResult | void>;
  /**
   * Delete several documents, reporting once for the batch rather than once per document.
   *
   * There is no batch delete mutation server-side, so this issues one request per id. They are
   * sequential on purpose: deleting a charge's last document deletes the charge too, and letting
   * several of those race would have them fighting over the same charge rows.
   */
  batchDeleteDocuments: (
    documentIds: string[],
  ) => Promise<{ deleted: number; failed: number } | void>;
};

const NOTIFICATION_ID = 'deleteDocument';

export const useDeleteDocument = (): UseDeleteDocument => {
  // TODO: add authentication
  // TODO: add local data delete method after change

  const { fetching, execute } = useApiMutation({
    document: DeleteDocumentDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.documentId}`,
    loadingMessage: 'Deleting Document',
    errorMessage: variables => `Error deleting document ID [${variables.documentId}]`,
    select: data => {
      if (data.deleteDocument.success === false) {
        throw new Error('Unsuccessful deletion');
      }
      return data.deleteDocument;
    },
    successToast: result => ({
      description: result.deletedChargeId
        ? 'Document was deleted, along with its now-empty charge'
        : 'Document was deleted',
    }),
  });

  // The batch path deliberately does not go through `useApiMutation`: that hook is one call, one
  // toast, and a bulk delete of twenty documents would stack twenty notifications. Fanning out here
  // keeps a single loading toast that resolves into one summary.
  const [, mutate] = useMutation(DeleteDocumentDocument);

  const batchDeleteDocuments = useCallback(
    async (documentIds: string[]) => {
      const message = 'Error deleting documents';
      const notificationId = `${NOTIFICATION_ID}-batch`;
      toast.loading(`Deleting ${documentIds.length} documents`, { id: notificationId });
      try {
        let deleted = 0;
        const failures: string[] = [];
        for (const documentId of documentIds) {
          try {
            const res = await mutate({ documentId });
            if (res.error || res.data?.deleteDocument.success === false) {
              failures.push(documentId);
            } else {
              deleted += 1;
            }
          } catch (e) {
            console.error(`Error deleting document ID [${documentId}]: ${e}`);
            failures.push(documentId);
          }
        }

        if (deleted === 0) {
          throw new Error(`None of the ${documentIds.length} documents could be deleted`);
        }
        if (failures.length > 0) {
          toast.warning('Partial success', {
            id: notificationId,
            description: `${deleted}/${documentIds.length} documents deleted. ${failures.length} failed.`,
            duration: 100_000,
            closeButton: true,
          });
        } else {
          toast.success('Success', {
            id: notificationId,
            description: `${deleted} documents were deleted`,
          });
        }
        return { deleted, failed: failures.length };
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: e instanceof Error ? e.message : message,
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
    deleteDocument: execute,
    batchDeleteDocuments,
  };
};
