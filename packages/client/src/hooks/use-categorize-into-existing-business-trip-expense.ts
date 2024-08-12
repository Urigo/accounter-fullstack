import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  CategorizeIntoExistingBusinessTripExpenseDocument,
  CategorizeIntoExistingBusinessTripExpenseMutation,
  CategorizeIntoExistingBusinessTripExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CategorizeIntoExistingBusinessTripExpense(
    $fields: CategorizeIntoExistingBusinessTripExpenseInput!
  ) {
    categorizeIntoExistingBusinessTripExpense(fields: $fields)
  }
`;

type UseCategorizeIntoExistingBusinessTripExpense = {
  fetching: boolean;
  categorizeIntoExistingBusinessTripExpense: (
    variables: CategorizeIntoExistingBusinessTripExpenseMutationVariables,
  ) => Promise<
    CategorizeIntoExistingBusinessTripExpenseMutation['categorizeIntoExistingBusinessTripExpense']
  >;
};

export const useCategorizeIntoExistingBusinessTripExpense =
  (): UseCategorizeIntoExistingBusinessTripExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(CategorizeIntoExistingBusinessTripExpenseDocument);

    return {
      fetching,
      categorizeIntoExistingBusinessTripExpense: (
        variables: CategorizeIntoExistingBusinessTripExpenseMutationVariables,
      ): Promise<
        CategorizeIntoExistingBusinessTripExpenseMutation['categorizeIntoExistingBusinessTripExpense']
      > =>
        new Promise<
          CategorizeIntoExistingBusinessTripExpenseMutation['categorizeIntoExistingBusinessTripExpense']
        >((resolve, reject) =>
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
            return resolve(res.data.categorizeIntoExistingBusinessTripExpense);
          }),
        ),
    };
  };
