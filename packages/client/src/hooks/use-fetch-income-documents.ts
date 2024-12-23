import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import { NewDocumentsList } from '../components/common/new-documents-list.js';
import {
  FetchIncomeDocumentsDocument,
  FetchIncomeDocumentsMutation,
  FetchIncomeDocumentsMutationVariables,
} from '../gql/graphql.js';

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
  ) => Promise<FetchIncomeDocuments>;
};

const NOTIFICATION_ID = 'fetchIncomeDocuments';

export const useFetchIncomeDocuments = (): UseFetchIncomeDocuments => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(FetchIncomeDocumentsDocument);

  return {
    fetching,
    fetchIncomeDocuments: (
      variables: FetchIncomeDocumentsMutationVariables,
    ): Promise<FetchIncomeDocuments> =>
      new Promise<FetchIncomeDocuments>((resolve, reject) => {
        notifications.show({
          id: NOTIFICATION_ID,
          loading: true,
          title: 'Fetching Documents',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        return mutate(variables)
          .then(res => {
            if (res.error) {
              console.error(
                `Error fetching documents owned by [${variables.ownerId}]: ${res.error}`,
              );
              notifications.update({
                id: NOTIFICATION_ID,
                title: 'Error!',
                message: 'Oh no!, we have an error! 🤥',
                color: 'red',
                autoClose: 5000,
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error(
                `Error fetching documents owned by [${variables.ownerId}]: No data returned`,
              );
              notifications.update({
                id: NOTIFICATION_ID,
                title: 'Error!',
                message: 'Oh no!, we have an error! 🤥',
                color: 'red',
                autoClose: 5000,
              });
              return reject('No data returned');
            }
            notifications.update({
              id: NOTIFICATION_ID,
              title: 'Fetch Success!',
              autoClose: res.data.fetchIncomeDocuments.length > 0 ? false : 5000,
              message:
                res.data.fetchIncomeDocuments.length > 0
                  ? NewDocumentsList({ data: res.data.fetchIncomeDocuments })
                  : 'No new documents found',
              withCloseButton: true,
            });
            return resolve(res.data.fetchIncomeDocuments);
          })
          .catch(() => {
            notifications.update({
              id: NOTIFICATION_ID,
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
              color: 'red',
              autoClose: 5000,
            });
          });
      }),
  };
};
