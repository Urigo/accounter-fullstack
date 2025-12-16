import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { NewDocumentsList } from '../components/common/new-documents-list.jsx';
import {
  SyncGreenInvoiceDocumentsDocument,
  type SyncGreenInvoiceDocumentsMutation,
  type SyncGreenInvoiceDocumentsMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SyncGreenInvoiceDocuments($ownerId: UUID!) {
    syncGreenInvoiceDocuments(ownerId: $ownerId) {
      id
      ...NewFetchedDocumentFields
    }
  }
`;

type SyncGreenInvoiceDocuments = SyncGreenInvoiceDocumentsMutation['syncGreenInvoiceDocuments'];

type UseSyncGreenInvoiceDocuments = {
  fetching: boolean;
  syncGreenInvoiceDocuments: (
    variables: SyncGreenInvoiceDocumentsMutationVariables,
  ) => Promise<SyncGreenInvoiceDocuments | void>;
};

const NOTIFICATION_ID = 'sync-green-invoice-documents';

export const useSyncGreenInvoiceDocuments = (): UseSyncGreenInvoiceDocuments => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(SyncGreenInvoiceDocumentsDocument);
  const syncGreenInvoiceDocuments = useCallback(
    async (variables: SyncGreenInvoiceDocumentsMutationVariables) => {
      const message = `Error syncing documents owned by [${variables.ownerId}]`;
      toast.loading('Syncing Documents', {
        id: NOTIFICATION_ID,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, NOTIFICATION_ID);
        if (data) {
          toast.success('Success', {
            id: NOTIFICATION_ID,
            description:
              data.syncGreenInvoiceDocuments.length > 0
                ? NewDocumentsList({ data: data.syncGreenInvoiceDocuments })
                : 'No new documents found',
            duration: data.syncGreenInvoiceDocuments.length > 0 ? Infinity : 5000,
            closeButton: data.syncGreenInvoiceDocuments.length > 0 ? true : false,
          });
          return data.syncGreenInvoiceDocuments;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: NOTIFICATION_ID,
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
    syncGreenInvoiceDocuments,
  };
};
