import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { NewDocumentsList } from '../components/common/new-documents-list.js';
import {
  FetchIncomeDocumentsDocument,
  type FetchIncomeDocumentsMutation,
  type FetchIncomeDocumentsMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation FetchIncomeDocuments($ownerId: UUID!) {
    fetchIncomeDocuments(ownerId: $ownerId) {
      id
      ...NewFetchedDocumentFields
    }
  }
`;

type FetchIncomeDocuments = FetchIncomeDocumentsMutation['fetchIncomeDocuments'];

type UseFetchIncomeDocuments = {
  fetching: boolean;
  fetchIncomeDocuments: (
    variables: FetchIncomeDocumentsMutationVariables,
  ) => Promise<FetchIncomeDocuments | void>;
};

const NOTIFICATION_ID = 'fetchIncomeDocuments';

export const useFetchIncomeDocuments = (): UseFetchIncomeDocuments => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(FetchIncomeDocumentsDocument);
  const fetchIncomeDocuments = useCallback(
    async (variables: FetchIncomeDocumentsMutationVariables) => {
      const message = `Error fetching documents owned by [${variables.ownerId}]`;
      toast.loading('Fetching Documents', {
        id: NOTIFICATION_ID,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, NOTIFICATION_ID);
        if (data) {
          toast.success('Success', {
            id: NOTIFICATION_ID,
            description:
              data.fetchIncomeDocuments.length > 0
                ? NewDocumentsList({ data: data.fetchIncomeDocuments })
                : 'No new documents found',
            duration: data.fetchIncomeDocuments.length > 0 ? Infinity : 5000,
            closeButton: data.fetchIncomeDocuments.length > 0 ? true : false,
          });
          return data.fetchIncomeDocuments;
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
    fetchIncomeDocuments,
  };
};
