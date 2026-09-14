import {
  UpdateBusinessTripFlightsExpenseDocument,
  type UpdateBusinessTripFlightsExpenseMutation,
  type UpdateBusinessTripFlightsExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripFlightsExpense($fields: UpdateBusinessTripFlightsExpenseInput!) {
    updateBusinessTripFlightsExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripFlightsExpense = {
  fetching: boolean;
  updateBusinessTripFlightsExpense: (
    variables: UpdateBusinessTripFlightsExpenseMutationVariables,
  ) => Promise<UpdateBusinessTripFlightsExpenseMutation['updateBusinessTripFlightsExpense'] | void>;
};

const NOTIFICATION_ID = 'updateBusinessTripFlightsExpense';

export const useUpdateBusinessTripFlightsExpense = (): UseUpdateBusinessTripFlightsExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const { fetching, execute } = useApiMutation({
    document: UpdateBusinessTripFlightsExpenseDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Updating trip flights expense',
    errorMessage: 'Error updating business trip flights expense',
    select: data => data.updateBusinessTripFlightsExpense,
    successToast: { description: 'Business trip flights expense was updated' },
  });

  return {
    fetching,
    updateBusinessTripFlightsExpense: execute,
  };
};
