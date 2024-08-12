import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  DeleteBusinessTripExpenseDocument,
  DeleteBusinessTripExpenseMutation,
  DeleteBusinessTripExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteBusinessTripExpense($businessTripExpenseId: UUID!) {
    deleteBusinessTripExpense(businessTripExpenseId: $businessTripExpenseId)
  }
`;

type UseDeleteBusinessTripExpense = {
  fetching: boolean;
  deleteBusinessTripExpense: (
    variables: DeleteBusinessTripExpenseMutationVariables,
  ) => Promise<DeleteBusinessTripExpenseMutation['deleteBusinessTripExpense']>;
};

export const useDeleteBusinessTripExpense = (): UseDeleteBusinessTripExpense => {
  // TODO: add authentication
  // TODO: add local data delete method after delete

  const [{ fetching }, mutate] = useMutation(DeleteBusinessTripExpenseDocument);

  return {
    fetching,
    deleteBusinessTripExpense: (
      variables: DeleteBusinessTripExpenseMutationVariables,
    ): Promise<DeleteBusinessTripExpenseMutation['deleteBusinessTripExpense']> =>
      new Promise<DeleteBusinessTripExpenseMutation['deleteBusinessTripExpense']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error deleting business trip expense: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, expense was not deleted',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error deleting business trip expense: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, expense was not deleted',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Removal Success!',
              message: 'Business trip expense was deleted! 🎉',
            });
            return resolve(res.data.deleteBusinessTripExpense);
          }),
      ),
  };
};
