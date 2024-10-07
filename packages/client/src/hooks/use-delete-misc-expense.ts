import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  DeleteMiscExpenseDocument,
  DeleteMiscExpenseMutation,
  DeleteMiscExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteMiscExpense($id: UUID!) {
    deleteMiscExpense(id: $id)
  }
`;

type UseDeleteMiscExpense = {
  fetching: boolean;
  deleteMiscExpense: (
    variables: DeleteMiscExpenseMutationVariables,
  ) => Promise<DeleteMiscExpenseMutation['deleteMiscExpense']>;
};

export const useDeleteMiscExpense = (): UseDeleteMiscExpense => {
  // TODO: add authentication
  // TODO: add local data update method after deletion

  const [{ fetching }, mutate] = useMutation(DeleteMiscExpenseDocument);

  return {
    fetching,
    deleteMiscExpense: (
      variables: DeleteMiscExpenseMutationVariables,
    ): Promise<DeleteMiscExpenseMutation['deleteMiscExpense']> =>
      new Promise<DeleteMiscExpenseMutation['deleteMiscExpense']>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error deleting misc expense: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error('Error deleting misc expense: No data returned');
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.deleteMiscExpense === false) {
            console.error("Error deleting misc expense: Received 'false' from server");
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject("Received 'false' from server");
          }
          showNotification({
            title: 'Deletion Success!',
            message: 'Misc expense was deleted successfully! 🎉',
          });
          return resolve(res.data.deleteMiscExpense);
        }),
      ),
  };
};
