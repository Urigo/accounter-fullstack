import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateBusinessTripCarRentalExpenseDocument,
  UpdateBusinessTripCarRentalExpenseMutation,
  UpdateBusinessTripCarRentalExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripCarRentalExpense($fields: UpdateBusinessTripCarRentalExpenseInput!) {
    updateBusinessTripCarRentalExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripCarRentalExpense = {
  fetching: boolean;
  updateBusinessTripCarRentalExpense: (
    variables: UpdateBusinessTripCarRentalExpenseMutationVariables,
  ) => Promise<UpdateBusinessTripCarRentalExpenseMutation['updateBusinessTripCarRentalExpense']>;
};

export const useUpdateBusinessTripCarRentalExpense = (): UseUpdateBusinessTripCarRentalExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(UpdateBusinessTripCarRentalExpenseDocument);

  return {
    fetching,
    updateBusinessTripCarRentalExpense: (
      variables: UpdateBusinessTripCarRentalExpenseMutationVariables,
    ): Promise<UpdateBusinessTripCarRentalExpenseMutation['updateBusinessTripCarRentalExpense']> =>
      new Promise<UpdateBusinessTripCarRentalExpenseMutation['updateBusinessTripCarRentalExpense']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error updating business trip car rental expense: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, car rental expense was not updated',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error updating business trip car rental expense: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, car rental expense was not updated',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Update Success!',
              message: 'Business trip car rental expense was updated! 🎉',
            });
            return resolve(res.data.updateBusinessTripCarRentalExpense);
          }),
      ),
  };
};
