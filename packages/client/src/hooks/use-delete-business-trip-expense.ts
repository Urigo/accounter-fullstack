import {
  DeleteBusinessTripExpenseDocument,
  type DeleteBusinessTripExpenseMutation,
  type DeleteBusinessTripExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteBusinessTripExpense($businessTripExpenseId: UUID!) {
    deleteBusinessTripExpense(businessTripExpenseId: $businessTripExpenseId)
  }
`;

type UseDeleteBusinessTripExpense = {
  fetching: boolean;
  deleteBusinessTripExpense: (
    variables: DeleteBusinessTripExpenseMutationVariables,
  ) => Promise<DeleteBusinessTripExpenseMutation['deleteBusinessTripExpense'] | void>;
};

const NOTIFICATION_ID = 'deleteBusinessTripExpense';

export const useDeleteBusinessTripExpense = (): UseDeleteBusinessTripExpense => {
  // TODO: add authentication
  // TODO: add local data delete method after delete

  const { fetching, execute } = useApiMutation({
    document: DeleteBusinessTripExpenseDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.businessTripExpenseId}`,
    loadingMessage: 'Deleting trip expense',
    errorMessage: 'Error deleting business trip expense',
    select: data => data.deleteBusinessTripExpense,
    successToast: { description: 'Business trip expense was deleted' },
  });

  return {
    fetching,
    deleteBusinessTripExpense: execute,
  };
};
