import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  AddBusinessTripAccommodationsTransactionDocument,
  AddBusinessTripAccommodationsTransactionMutation,
  AddBusinessTripAccommodationsTransactionMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripAccommodationsTransaction($fields: AddBusinessTripAccommodationsTransactionInput!) {
    addBusinessTripAccommodationsTransaction(fields: $fields)
  }
`;

type UseAddBusinessTripAccommodationsTransaction = {
  fetching: boolean;
  addBusinessTripAccommodationsTransaction: (
    variables: AddBusinessTripAccommodationsTransactionMutationVariables,
  ) => Promise<
    AddBusinessTripAccommodationsTransactionMutation['addBusinessTripAccommodationsTransaction']
  >;
};

export const useAddBusinessTripAccommodationsTransaction =
  (): UseAddBusinessTripAccommodationsTransaction => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(AddBusinessTripAccommodationsTransactionDocument);

    return {
      fetching,
      addBusinessTripAccommodationsTransaction: (
        variables: AddBusinessTripAccommodationsTransactionMutationVariables,
      ): Promise<
        AddBusinessTripAccommodationsTransactionMutation['addBusinessTripAccommodationsTransaction']
      > =>
        new Promise<
          AddBusinessTripAccommodationsTransactionMutation['addBusinessTripAccommodationsTransaction']
        >((resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error adding business trip accommodations transaction: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, accommodations transaction was not added',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error(
                'Error adding business trip accommodations transaction: No data returned',
              );
              showNotification({
                title: 'Error!',
                message: 'Oops, accommodations transaction was not added',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Success!',
              message: 'Business trip accommodations transaction was added! 🎉',
            });
            return resolve(res.data.addBusinessTripAccommodationsTransaction);
          }),
        ),
    };
  };
