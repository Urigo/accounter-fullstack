import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { FetchDeelDocumentsDocument, type FetchDeelDocumentsMutation } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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
  const [{ fetching }, mutate] = useMutation(FetchDeelDocumentsDocument);

  const fetchDocuments = useCallback(async () => {
    const message = 'Failed to fetch Deel documents';
    toast.loading('Fetching Deel documents', { id: NOTIFICATION_ID });
    try {
      const res = await mutate({});
      const data = handleCommonErrors(res, message, NOTIFICATION_ID);
      if (data?.fetchDeelDocuments) {
        toast.success('Success', {
          id: NOTIFICATION_ID,
          description: `Fetched ${data.fetchDeelDocuments.length} Deel charge(s)`,
        });
        return data.fetchDeelDocuments;
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
  }, [mutate]);

  return { fetching, fetchDocuments };
};
