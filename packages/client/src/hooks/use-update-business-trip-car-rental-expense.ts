import {
  UpdateBusinessTripCarRentalExpenseDocument,
  type UpdateBusinessTripCarRentalExpenseMutation,
  type UpdateBusinessTripCarRentalExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripCarRentalExpense($fields: UpdateBusinessTripCarRentalExpenseInput!) {
    updateBusinessTripCarRentalExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripCarRentalExpense = {
  fetching: boolean;
  updateBusinessTripCarRentalExpense: (
    variables: UpdateBusinessTripCarRentalExpenseMutationVariables,
  ) => Promise<
    UpdateBusinessTripCarRentalExpenseMutation['updateBusinessTripCarRentalExpense'] | void
  >;
};

const NOTIFICATION_ID = 'updateBusinessTripCarRentalExpense';

export const useUpdateBusinessTripCarRentalExpense = (): UseUpdateBusinessTripCarRentalExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const { fetching, execute } = useApiMutation({
    document: UpdateBusinessTripCarRentalExpenseDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Updating trip car rental expense',
    errorMessage: 'Error updating business trip car rental expense',
    select: data => data.updateBusinessTripCarRentalExpense,
    successToast: { description: 'Business trip car rental expense was updated' },
  });

  return {
    fetching,
    updateBusinessTripCarRentalExpense: execute,
  };
};
