import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  CategorizeBusinessTripExpenseDocument,
  CategorizeBusinessTripExpenseMutation,
  CategorizeBusinessTripExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CategorizeBusinessTripExpense($fields: CategorizeBusinessTripExpenseInput!) {
    categorizeBusinessTripExpense(fields: $fields)
  }
`;

type UseCategorizeBusinessTripExpense = {
  fetching: boolean;
  categorizeBusinessTripExpense: (
    variables: CategorizeBusinessTripExpenseMutationVariables,
  ) => Promise<CategorizeBusinessTripExpenseMutation['categorizeBusinessTripExpense']>;
};

export const useCategorizeBusinessTripExpense = (): UseCategorizeBusinessTripExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(CategorizeBusinessTripExpenseDocument);

  return {
    fetching,
    categorizeBusinessTripExpense: (
      variables: CategorizeBusinessTripExpenseMutationVariables,
    ): Promise<CategorizeBusinessTripExpenseMutation['categorizeBusinessTripExpense']> =>
      new Promise<CategorizeBusinessTripExpenseMutation['categorizeBusinessTripExpense']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error updating business trip expense category: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, expense category was not updated',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error updating business trip expense category: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, expense category was not updated',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Update Success!',
              message: 'Business trip expense category was updated! 🎉',
            });
            return resolve(res.data.categorizeBusinessTripExpense);
          }),
      ),
  };
};
