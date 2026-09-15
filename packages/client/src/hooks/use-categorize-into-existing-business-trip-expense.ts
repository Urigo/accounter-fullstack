import {
  CategorizeIntoExistingBusinessTripExpenseDocument,
  type CategorizeIntoExistingBusinessTripExpenseMutation,
  type CategorizeIntoExistingBusinessTripExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
    | CategorizeIntoExistingBusinessTripExpenseMutation['categorizeIntoExistingBusinessTripExpense']
    | void
  >;
};

const NOTIFICATION_ID = 'categorizeIntoExistingBusinessTripExpense';

export const useCategorizeIntoExistingBusinessTripExpense =
  (): UseCategorizeIntoExistingBusinessTripExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const { fetching, execute } = useApiMutation({
      document: CategorizeIntoExistingBusinessTripExpenseDocument,
      notificationId: NOTIFICATION_ID,
      loadingMessage: 'Updating business trip expense category',
      errorMessage: 'Error updating business trip expense category',
      select: data => data.categorizeIntoExistingBusinessTripExpense,
      successToast: { description: 'Business trip expense category was updated' },
    });

    return {
      fetching,
      categorizeIntoExistingBusinessTripExpense: execute,
    };
  };
