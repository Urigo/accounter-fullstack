import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateBusinessTripFlightsTransactionDocument,
  UpdateBusinessTripFlightsTransactionMutation,
  UpdateBusinessTripFlightsTransactionMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripFlightsTransaction(
    $fields: UpdateBusinessTripFlightsTransactionInput!
  ) {
    updateBusinessTripFlightsTransaction(fields: $fields)
  }
`;

type UseUpdateBusinessTripFlightsTransaction = {
  fetching: boolean;
  updateBusinessTripFlightsTransaction: (
    variables: UpdateBusinessTripFlightsTransactionMutationVariables,
  ) => Promise<
    UpdateBusinessTripFlightsTransactionMutation['updateBusinessTripFlightsTransaction']
  >;
};

export const useUpdateBusinessTripFlightsTransaction =
  (): UseUpdateBusinessTripFlightsTransaction => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(UpdateBusinessTripFlightsTransactionDocument);

    return {
      fetching,
      updateBusinessTripFlightsTransaction: (
        variables: UpdateBusinessTripFlightsTransactionMutationVariables,
      ): Promise<
        UpdateBusinessTripFlightsTransactionMutation['updateBusinessTripFlightsTransaction']
      > =>
        new Promise<
          UpdateBusinessTripFlightsTransactionMutation['updateBusinessTripFlightsTransaction']
        >((resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error updating business trip flights transaction: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, flights transaction was not updated',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error updating business trip flights transaction: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, flights transaction was not updated',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Update Success!',
              message: 'Business trip flights transaction was updated! 🎉',
            });
            return resolve(res.data.updateBusinessTripFlightsTransaction);
          }),
        ),
    };
  };
