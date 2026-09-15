import {
  AddBusinessTripCarRentalExpenseDocument,
  type AddBusinessTripCarRentalExpenseMutation,
  type AddBusinessTripCarRentalExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripCarRentalExpense($fields: AddBusinessTripCarRentalExpenseInput!) {
    addBusinessTripCarRentalExpense(fields: $fields)
  }
`;

type UseAddBusinessTripCarRentalExpense = {
  fetching: boolean;
  addBusinessTripCarRentalExpense: (
    variables: AddBusinessTripCarRentalExpenseMutationVariables,
  ) => Promise<AddBusinessTripCarRentalExpenseMutation['addBusinessTripCarRentalExpense'] | void>;
};

const NOTIFICATION_ID = 'addBusinessTripCarRentalExpense';

export const useAddBusinessTripCarRentalExpense = (): UseAddBusinessTripCarRentalExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const { fetching, execute } = useApiMutation({
    document: AddBusinessTripCarRentalExpenseDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Adding car rental expense...',
    errorMessage: 'Error adding business trip car rental expense',
    select: data => data.addBusinessTripCarRentalExpense,
    successToast: { description: 'Car rental expense added' },
  });

  return {
    fetching,
    addBusinessTripCarRentalExpense: execute,
  };
};
