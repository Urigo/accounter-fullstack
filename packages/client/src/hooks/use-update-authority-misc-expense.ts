import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateAuthoritiesMiscExpenseDocument,
  UpdateAuthoritiesMiscExpenseMutation,
  UpdateAuthoritiesMiscExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateAuthoritiesMiscExpense(
    $transactionId: UUID!
    $fields: UpdateAuthoritiesExpenseInput!
  ) {
    updateAuthoritiesExpense(transactionId: $transactionId, fields: $fields) {
      transactionId
    }
  }
`;

type UseUpdateAuthoritiesMiscExpense = {
  fetching: boolean;
  updateAuthoritiesMiscExpense: (
    variables: UpdateAuthoritiesMiscExpenseMutationVariables,
  ) => Promise<UpdateAuthoritiesMiscExpenseMutation['updateAuthoritiesExpense']>;
};

export const useUpdateAuthoritiesMiscExpense = (): UseUpdateAuthoritiesMiscExpense => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateAuthoritiesMiscExpenseDocument);

  return {
    fetching,
    updateAuthoritiesMiscExpense: (
      variables: UpdateAuthoritiesMiscExpenseMutationVariables,
    ): Promise<UpdateAuthoritiesMiscExpenseMutation['updateAuthoritiesExpense']> =>
      new Promise<UpdateAuthoritiesMiscExpenseMutation['updateAuthoritiesExpense']>(
        (resolve, reject) =>
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
            return resolve(res.data.updateAuthoritiesExpense);
          }),
      ),
  };
};
