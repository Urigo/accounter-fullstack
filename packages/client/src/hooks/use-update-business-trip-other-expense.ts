import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateBusinessTripOtherExpenseDocument,
  UpdateBusinessTripOtherExpenseMutation,
  UpdateBusinessTripOtherExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripOtherExpense($fields: UpdateBusinessTripOtherExpenseInput!) {
    updateBusinessTripOtherExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripOtherExpense = {
  fetching: boolean;
  updateBusinessTripOtherExpense: (
    variables: UpdateBusinessTripOtherExpenseMutationVariables,
  ) => Promise<UpdateBusinessTripOtherExpenseMutation['updateBusinessTripOtherExpense']>;
};

export const useUpdateBusinessTripOtherExpense = (): UseUpdateBusinessTripOtherExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(UpdateBusinessTripOtherExpenseDocument);

  return {
    fetching,
    updateBusinessTripOtherExpense: (
      variables: UpdateBusinessTripOtherExpenseMutationVariables,
    ): Promise<UpdateBusinessTripOtherExpenseMutation['updateBusinessTripOtherExpense']> =>
      new Promise<UpdateBusinessTripOtherExpenseMutation['updateBusinessTripOtherExpense']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error updating business trip "other" expense: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, "other" expense was not updated',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error updating business trip "other" expense: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, "other" expense was not updated',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Update Success!',
              message: 'Business trip "other" expense was updated! 🎉',
            });
            return resolve(res.data.updateBusinessTripOtherExpense);
          }),
      ),
  };
};
