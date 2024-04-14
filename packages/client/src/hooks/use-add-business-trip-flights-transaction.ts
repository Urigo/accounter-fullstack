import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  AddBusinessTripFlightsTransactionDocument,
  AddBusinessTripFlightsTransactionMutation,
  AddBusinessTripFlightsTransactionMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripFlightsTransaction($fields: AddBusinessTripFlightsTransactionInput!) {
    addBusinessTripFlightsTransaction(fields: $fields)
  }
`;

type UseAddBusinessTripFlightsTransaction = {
  fetching: boolean;
  addBusinessTripFlightsTransaction: (
    variables: AddBusinessTripFlightsTransactionMutationVariables,
  ) => Promise<AddBusinessTripFlightsTransactionMutation['addBusinessTripFlightsTransaction']>;
};

export const useAddBusinessTripFlightsTransaction = (): UseAddBusinessTripFlightsTransaction => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(AddBusinessTripFlightsTransactionDocument);

  return {
    fetching,
    addBusinessTripFlightsTransaction: (
      variables: AddBusinessTripFlightsTransactionMutationVariables,
    ): Promise<AddBusinessTripFlightsTransactionMutation['addBusinessTripFlightsTransaction']> =>
      new Promise<AddBusinessTripFlightsTransactionMutation['addBusinessTripFlightsTransaction']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error adding business trip flight transaction: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, flight transaction was not added',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error adding business trip flight transaction: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, flight transaction was not added',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Success!',
              message: 'Business trip flight transaction was added! 🎉',
            });
            return resolve(res.data.addBusinessTripFlightsTransaction);
          }),
      ),
  };
};
