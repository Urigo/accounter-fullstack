import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateBusinessTripFlightsExpenseDocument,
  UpdateBusinessTripFlightsExpenseMutation,
  UpdateBusinessTripFlightsExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripFlightsExpense($fields: UpdateBusinessTripFlightsExpenseInput!) {
    updateBusinessTripFlightsExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripFlightsExpense = {
  fetching: boolean;
  updateBusinessTripFlightsExpense: (
    variables: UpdateBusinessTripFlightsExpenseMutationVariables,
  ) => Promise<UpdateBusinessTripFlightsExpenseMutation['updateBusinessTripFlightsExpense']>;
};

export const useUpdateBusinessTripFlightsExpense = (): UseUpdateBusinessTripFlightsExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(UpdateBusinessTripFlightsExpenseDocument);

  return {
    fetching,
    updateBusinessTripFlightsExpense: (
      variables: UpdateBusinessTripFlightsExpenseMutationVariables,
    ): Promise<UpdateBusinessTripFlightsExpenseMutation['updateBusinessTripFlightsExpense']> =>
      new Promise<UpdateBusinessTripFlightsExpenseMutation['updateBusinessTripFlightsExpense']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error updating business trip flights expense: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, flights expense was not updated',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error updating business trip flights expense: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, flights expense was not updated',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Update Success!',
              message: 'Business trip flights expense was updated! 🎉',
            });
            return resolve(res.data.updateBusinessTripFlightsExpense);
          }),
      ),
  };
};
