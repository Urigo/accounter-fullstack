import { NewDocumentsList } from '../components/common/new-documents-list.js';
import {
  SyncGreenInvoiceDocumentsDocument,
  type SyncGreenInvoiceDocumentsMutation,
  type SyncGreenInvoiceDocumentsMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: SyncGreenInvoiceDocumentsDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Syncing Documents',
    errorMessage: variables => `Error syncing documents owned by [${variables.ownerId}]`,
    select: data => data.syncGreenInvoiceDocuments,
    // The list of new documents stays up until dismissed; "nothing new" can time out on its own.
    successToast: documents =>
      documents.length > 0
        ? {
            description: NewDocumentsList({ data: documents }),
            duration: Infinity,
            closeButton: true,
          }
        : { description: 'No new documents found', duration: 5000, closeButton: false },
  });

  return {
    fetching,
    syncGreenInvoiceDocuments: execute,
  };
};
