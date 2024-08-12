import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateBusinessTripAccommodationsExpenseDocument,
  UpdateBusinessTripAccommodationsExpenseMutation,
  UpdateBusinessTripAccommodationsExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripAccommodationsExpense(
    $fields: UpdateBusinessTripAccommodationsExpenseInput!
  ) {
    updateBusinessTripAccommodationsExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripAccommodationsExpense = {
  fetching: boolean;
  updateBusinessTripAccommodationsExpense: (
    variables: UpdateBusinessTripAccommodationsExpenseMutationVariables,
  ) => Promise<
    UpdateBusinessTripAccommodationsExpenseMutation['updateBusinessTripAccommodationsExpense']
  >;
};

export const useUpdateBusinessTripAccommodationsExpense =
  (): UseUpdateBusinessTripAccommodationsExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(UpdateBusinessTripAccommodationsExpenseDocument);

    return {
      fetching,
      updateBusinessTripAccommodationsExpense: (
        variables: UpdateBusinessTripAccommodationsExpenseMutationVariables,
      ): Promise<
        UpdateBusinessTripAccommodationsExpenseMutation['updateBusinessTripAccommodationsExpense']
      > =>
        new Promise<
          UpdateBusinessTripAccommodationsExpenseMutation['updateBusinessTripAccommodationsExpense']
        >((resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error updating business trip accommodations expense: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, accommodations expense was not updated',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error(
                'Error updating business trip accommodations expense: No data returned',
              );
              showNotification({
                title: 'Error!',
                message: 'Oops, accommodations expense was not updated',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Update Success!',
              message: 'Business trip accommodations expense was updated! 🎉',
            });
            return resolve(res.data.updateBusinessTripAccommodationsExpense);
          }),
        ),
    };
  };
