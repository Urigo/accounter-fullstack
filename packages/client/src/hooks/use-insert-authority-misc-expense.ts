import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  InsertAuthorityMiscExpenseDocument,
  InsertAuthorityMiscExpenseMutation,
  InsertAuthorityMiscExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertAuthorityMiscExpense($fields: InsertAuthoritiesExpenseInput!) {
    insertAuthoritiesExpense(fields: $fields) {
      transactionId
    }
  }
`;

type UseInsertAuthorityMiscExpense = {
  fetching: boolean;
  insertAuthorityMiscExpense: (
    variables: InsertAuthorityMiscExpenseMutationVariables,
  ) => Promise<InsertAuthorityMiscExpenseMutation['insertAuthoritiesExpense']>;
};

export const useInsertAuthorityMiscExpense = (): UseInsertAuthorityMiscExpense => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertAuthorityMiscExpenseDocument);

  return {
    fetching,
    insertAuthorityMiscExpense: (
      variables: InsertAuthorityMiscExpenseMutationVariables,
    ): Promise<InsertAuthorityMiscExpenseMutation['insertAuthoritiesExpense']> =>
      new Promise<InsertAuthorityMiscExpenseMutation['insertAuthoritiesExpense']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error creating authorities misc expense: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oh no!, we have an error! 🤥',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error creating authorities misc expense: No data returned');
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
            return resolve(res.data.insertAuthoritiesExpense);
          }),
      ),
  };
};
