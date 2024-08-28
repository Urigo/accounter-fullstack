import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  AddBusinessTripCarRentalExpenseDocument,
  AddBusinessTripCarRentalExpenseMutation,
  AddBusinessTripCarRentalExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripCarRentalExpense($fields: AddBusinessTripCarRentalExpenseInput!) {
    addBusinessTripCarRentalExpense(fields: $fields)
  }
`;

type UseAddBusinessTripCarRentalExpense = {
  fetching: boolean;
  addBusinessTripCarRentalExpense: (
    variables: AddBusinessTripCarRentalExpenseMutationVariables,
  ) => Promise<AddBusinessTripCarRentalExpenseMutation['addBusinessTripCarRentalExpense']>;
};

export const useAddBusinessTripCarRentalExpense = (): UseAddBusinessTripCarRentalExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(AddBusinessTripCarRentalExpenseDocument);

  return {
    fetching,
    addBusinessTripCarRentalExpense: (
      variables: AddBusinessTripCarRentalExpenseMutationVariables,
    ): Promise<AddBusinessTripCarRentalExpenseMutation['addBusinessTripCarRentalExpense']> =>
      new Promise<AddBusinessTripCarRentalExpenseMutation['addBusinessTripCarRentalExpense']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error adding business trip car rental expense: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, car rental expense was not added',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error adding business trip car rental expense: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, car rental expense was not added',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Success!',
              message: 'Business trip car rental expense was added! 🎉',
            });
            return resolve(res.data.addBusinessTripCarRentalExpense);
          }),
      ),
  };
};
