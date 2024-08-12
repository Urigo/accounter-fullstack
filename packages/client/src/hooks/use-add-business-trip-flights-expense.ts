import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  AddBusinessTripFlightsExpenseDocument,
  AddBusinessTripFlightsExpenseMutation,
  AddBusinessTripFlightsExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripFlightsExpense($fields: AddBusinessTripFlightsExpenseInput!) {
    addBusinessTripFlightsExpense(fields: $fields)
  }
`;

type UseAddBusinessTripFlightsExpense = {
  fetching: boolean;
  addBusinessTripFlightsExpense: (
    variables: AddBusinessTripFlightsExpenseMutationVariables,
  ) => Promise<AddBusinessTripFlightsExpenseMutation['addBusinessTripFlightsExpense']>;
};

export const useAddBusinessTripFlightsExpense = (): UseAddBusinessTripFlightsExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(AddBusinessTripFlightsExpenseDocument);

  return {
    fetching,
    addBusinessTripFlightsExpense: (
      variables: AddBusinessTripFlightsExpenseMutationVariables,
    ): Promise<AddBusinessTripFlightsExpenseMutation['addBusinessTripFlightsExpense']> =>
      new Promise<AddBusinessTripFlightsExpenseMutation['addBusinessTripFlightsExpense']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error adding business trip flight expense: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, flight expense was not added',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error adding business trip flight expense: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, flight expense was not added',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Success!',
              message: 'Business trip flight expense was added! 🎉',
            });
            return resolve(res.data.addBusinessTripFlightsExpense);
          }),
      ),
  };
};
