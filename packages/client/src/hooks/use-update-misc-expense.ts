import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateMiscExpenseDocument,
  UpdateMiscExpenseMutation,
  UpdateMiscExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateMiscExpense($transactionId: UUID!, $fields: UpdateMiscExpenseInput!) {
    updateMiscExpense(transactionId: $transactionId, fields: $fields) {
      transactionId
    }
  }
`;

type UseUpdateMiscExpense = {
  fetching: boolean;
  updateMiscExpense: (
    variables: UpdateMiscExpenseMutationVariables,
  ) => Promise<UpdateMiscExpenseMutation['updateMiscExpense']>;
};

export const useUpdateMiscExpense = (): UseUpdateMiscExpense => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateMiscExpenseDocument);

  return {
    fetching,
    updateMiscExpense: (
      variables: UpdateMiscExpenseMutationVariables,
    ): Promise<UpdateMiscExpenseMutation['updateMiscExpense']> =>
      new Promise<UpdateMiscExpenseMutation['updateMiscExpense']>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error updating misc expense for transaction ID [${variables.transactionId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error updating misc expense for transaction ID [${variables.transactionId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Update Success!',
            message: 'Hey there, your update is awesome!',
          });
          return resolve(res.data.updateMiscExpense);
        }),
      ),
  };
};
