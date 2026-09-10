import {
  AddBusinessTripAccommodationsExpenseDocument,
  type AddBusinessTripAccommodationsExpenseMutation,
  type AddBusinessTripAccommodationsExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripAccommodationsExpense(
    $fields: AddBusinessTripAccommodationsExpenseInput!
  ) {
    addBusinessTripAccommodationsExpense(fields: $fields)
  }
`;

type UseAddBusinessTripAccommodationsExpense = {
  fetching: boolean;
  addBusinessTripAccommodationsExpense: (
    variables: AddBusinessTripAccommodationsExpenseMutationVariables,
  ) => Promise<
    AddBusinessTripAccommodationsExpenseMutation['addBusinessTripAccommodationsExpense'] | void
  >;
};

const NOTIFICATION_ID = 'addBusinessTripAccommodationsExpense';

export const useAddBusinessTripAccommodationsExpense =
  (): UseAddBusinessTripAccommodationsExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const { fetching, execute } = useApiMutation({
      document: AddBusinessTripAccommodationsExpenseDocument,
      notificationId: NOTIFICATION_ID,
      loadingMessage: 'Adding Business Trip Accommodations Expense',
      errorMessage: 'Error adding business trip accommodations expense',
      select: data => data.addBusinessTripAccommodationsExpense,
      successToast: { description: 'Business trip accommodations expense added' },
    });

    return {
      fetching,
      addBusinessTripAccommodationsExpense: execute,
    };
  };
