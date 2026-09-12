import {
  AddBusinessTripFlightsExpenseDocument,
  type AddBusinessTripFlightsExpenseMutation,
  type AddBusinessTripFlightsExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripFlightsExpense($fields: AddBusinessTripFlightsExpenseInput!) {
    addBusinessTripFlightsExpense(fields: $fields)
  }
`;

type UseAddBusinessTripFlightsExpense = {
  fetching: boolean;
  addBusinessTripFlightsExpense: (
    variables: AddBusinessTripFlightsExpenseMutationVariables,
  ) => Promise<AddBusinessTripFlightsExpenseMutation['addBusinessTripFlightsExpense'] | void>;
};

const NOTIFICATION_ID = 'addBusinessTripFlightsExpense';

export const useAddBusinessTripFlightsExpense = (): UseAddBusinessTripFlightsExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const { fetching, execute } = useApiMutation({
    document: AddBusinessTripFlightsExpenseDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Adding business trip flight expense',
    errorMessage: 'Error adding business trip flight expense',
    select: data => data.addBusinessTripFlightsExpense,
    successToast: { description: 'Business trip flight expense added' },
  });

  return {
    fetching,
    addBusinessTripFlightsExpense: execute,
  };
};
