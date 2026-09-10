import {
  UpdateBusinessTripAccommodationsExpenseDocument,
  type UpdateBusinessTripAccommodationsExpenseMutation,
  type UpdateBusinessTripAccommodationsExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripAccommodationsExpense(
    $fields: UpdateBusinessTripAccommodationsExpenseInput!
  ) {
    updateBusinessTripAccommodationsExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripAccommodationsExpense = {
  fetching: boolean;
  updateBusinessTripAccommodationsExpense: (
    variables: UpdateBusinessTripAccommodationsExpenseMutationVariables,
  ) => Promise<
    | UpdateBusinessTripAccommodationsExpenseMutation['updateBusinessTripAccommodationsExpense']
    | void
  >;
};

const NOTIFICATION_ID = 'updateBusinessTripAccommodationsExpense';

export const useUpdateBusinessTripAccommodationsExpense =
  (): UseUpdateBusinessTripAccommodationsExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const { fetching, execute } = useApiMutation({
      document: UpdateBusinessTripAccommodationsExpenseDocument,
      notificationId: NOTIFICATION_ID,
      loadingMessage: 'Updating trip accommodations expense',
      errorMessage: 'Error updating business trip accommodations expense',
      select: data => data.updateBusinessTripAccommodationsExpense,
      successToast: { description: 'Business trip accommodations expense was updated' },
    });

    return {
      fetching,
      updateBusinessTripAccommodationsExpense: execute,
    };
  };
