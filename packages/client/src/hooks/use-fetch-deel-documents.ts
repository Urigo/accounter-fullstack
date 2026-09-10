import { useCallback } from 'react';
import { FetchDeelDocumentsDocument, type FetchDeelDocumentsMutation } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation FetchDeelDocuments {
    fetchDeelDocuments {
      id
    }
  }
`;

type FetchDeelDocumentsResult = FetchDeelDocumentsMutation['fetchDeelDocuments'];

type UseFetchDeelDocuments = {
  fetching: boolean;
  fetchDocuments: () => Promise<FetchDeelDocumentsResult | void>;
};

const NOTIFICATION_ID = 'fetch-deel-documents';

export const useFetchDeelDocuments = (): UseFetchDeelDocuments => {
  const { fetching, execute } = useApiMutation({
    document: FetchDeelDocumentsDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Fetching Deel documents',
    errorMessage: 'Failed to fetch Deel documents',
    select: data => data.fetchDeelDocuments,
    successToast: documents => ({
      description: `Fetched ${documents.length} Deel charge(s)`,
    }),
  });

  const fetchDocuments = useCallback(() => execute({}), [execute]);

  return { fetching, fetchDocuments };
};
