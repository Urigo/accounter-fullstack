import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateBusinessTripAccommodationsTransactionDocument,
  UpdateBusinessTripAccommodationsTransactionMutation,
  UpdateBusinessTripAccommodationsTransactionMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripAccommodationsTransaction($fields: UpdateBusinessTripAccommodationsTransactionInput!) {
    updateBusinessTripAccommodationsTransaction(fields: $fields)
  }
`;

type UseUpdateBusinessTripAccommodationsTransaction = {
  fetching: boolean;
  updateBusinessTripAccommodationsTransaction: (
    variables: UpdateBusinessTripAccommodationsTransactionMutationVariables,
  ) => Promise<
    UpdateBusinessTripAccommodationsTransactionMutation['updateBusinessTripAccommodationsTransaction']
  >;
};

export const useUpdateBusinessTripAccommodationsTransaction =
  (): UseUpdateBusinessTripAccommodationsTransaction => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(UpdateBusinessTripAccommodationsTransactionDocument);

    return {
      fetching,
      updateBusinessTripAccommodationsTransaction: (
        variables: UpdateBusinessTripAccommodationsTransactionMutationVariables,
      ): Promise<
        UpdateBusinessTripAccommodationsTransactionMutation['updateBusinessTripAccommodationsTransaction']
      > =>
        new Promise<
          UpdateBusinessTripAccommodationsTransactionMutation['updateBusinessTripAccommodationsTransaction']
        >((resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(
                `Error updating business trip accommodations transaction: ${res.error}`,
              );
              showNotification({
                title: 'Error!',
                message: 'Oops, accommodations transaction was not updated',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error(
                'Error updating business trip accommodations transaction: No data returned',
              );
              showNotification({
                title: 'Error!',
                message: 'Oops, accommodations transaction was not updated',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Update Success!',
              message: 'Business trip accommodations transaction was updated! 🎉',
            });
            return resolve(res.data.updateBusinessTripAccommodationsTransaction);
          }),
        ),
    };
  };
