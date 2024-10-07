import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  InsertMiscExpenseDocument,
  InsertMiscExpenseMutation,
  InsertMiscExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertMiscExpense($fields: InsertMiscExpenseInput!) {
    insertMiscExpense(fields: $fields) {
      id
    }
  }
`;

type UseInsertMiscExpense = {
  fetching: boolean;
  insertMiscExpense: (
    variables: InsertMiscExpenseMutationVariables,
  ) => Promise<InsertMiscExpenseMutation['insertMiscExpense']>;
};

export const useInsertMiscExpense = (): UseInsertMiscExpense => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertMiscExpenseDocument);

  return {
    fetching,
    insertMiscExpense: (
      variables: InsertMiscExpenseMutationVariables,
    ): Promise<InsertMiscExpenseMutation['insertMiscExpense']> =>
      new Promise<InsertMiscExpenseMutation['insertMiscExpense']>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error creating misc expense: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error('Error creating misc expense: No data returned');
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Insert Success!',
            message: 'Your document was added! 🎉',
          });
          return resolve(res.data.insertMiscExpense);
        }),
      ),
  };
};
