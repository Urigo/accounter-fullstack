import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  AddBusinessTripAccommodationsExpenseDocument,
  AddBusinessTripAccommodationsExpenseMutation,
  AddBusinessTripAccommodationsExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripAccommodationsExpense(
    $fields: AddBusinessTripAccommodationsExpenseInput!
  ) {
    addBusinessTripAccommodationsExpense(fields: $fields)
  }
`;

type UseAddBusinessTripAccommodationsExpense = {
  fetching: boolean;
  addBusinessTripAccommodationsExpense: (
    variables: AddBusinessTripAccommodationsExpenseMutationVariables,
  ) => Promise<
    AddBusinessTripAccommodationsExpenseMutation['addBusinessTripAccommodationsExpense']
  >;
};

export const useAddBusinessTripAccommodationsExpense =
  (): UseAddBusinessTripAccommodationsExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(AddBusinessTripAccommodationsExpenseDocument);

    return {
      fetching,
      addBusinessTripAccommodationsExpense: (
        variables: AddBusinessTripAccommodationsExpenseMutationVariables,
      ): Promise<
        AddBusinessTripAccommodationsExpenseMutation['addBusinessTripAccommodationsExpense']
      > =>
        new Promise<
          AddBusinessTripAccommodationsExpenseMutation['addBusinessTripAccommodationsExpense']
        >((resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error adding business trip accommodations expense: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, accommodations expense was not added',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error adding business trip accommodations expense: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, accommodations expense was not added',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Success!',
              message: 'Business trip accommodations expense was added! 🎉',
            });
            return resolve(res.data.addBusinessTripAccommodationsExpense);
          }),
        ),
    };
  };
