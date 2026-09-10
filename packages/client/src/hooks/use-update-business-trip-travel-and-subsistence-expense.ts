import {
  UpdateBusinessTripTravelAndSubsistenceExpenseDocument,
  type UpdateBusinessTripTravelAndSubsistenceExpenseMutation,
  type UpdateBusinessTripTravelAndSubsistenceExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripTravelAndSubsistenceExpense(
    $fields: UpdateBusinessTripTravelAndSubsistenceExpenseInput!
  ) {
    updateBusinessTripTravelAndSubsistenceExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripTravelAndSubsistenceExpense = {
  fetching: boolean;
  updateBusinessTripTravelAndSubsistenceExpense: (
    variables: UpdateBusinessTripTravelAndSubsistenceExpenseMutationVariables,
  ) => Promise<
    | UpdateBusinessTripTravelAndSubsistenceExpenseMutation['updateBusinessTripTravelAndSubsistenceExpense']
    | void
  >;
};

const NOTIFICATION_ID = 'updateBusinessTripTravelAndSubsistenceExpense';

export const useUpdateBusinessTripTravelAndSubsistenceExpense =
  (): UseUpdateBusinessTripTravelAndSubsistenceExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const { fetching, execute } = useApiMutation({
      document: UpdateBusinessTripTravelAndSubsistenceExpenseDocument,
      notificationId: NOTIFICATION_ID,
      loadingMessage: 'Updating trip travel&subsistence expense',
      errorMessage: 'Error updating business trip travel&subsistence expense',
      select: data => data.updateBusinessTripTravelAndSubsistenceExpense,
      successToast: { description: 'Business trip travel&subsistence expense was updated' },
    });

    return {
      fetching,
      updateBusinessTripTravelAndSubsistenceExpense: execute,
    };
  };
