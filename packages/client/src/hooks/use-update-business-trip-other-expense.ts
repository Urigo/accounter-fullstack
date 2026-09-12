import {
  UpdateBusinessTripOtherExpenseDocument,
  type UpdateBusinessTripOtherExpenseMutation,
  type UpdateBusinessTripOtherExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripOtherExpense($fields: UpdateBusinessTripOtherExpenseInput!) {
    updateBusinessTripOtherExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripOtherExpense = {
  fetching: boolean;
  updateBusinessTripOtherExpense: (
    variables: UpdateBusinessTripOtherExpenseMutationVariables,
  ) => Promise<UpdateBusinessTripOtherExpenseMutation['updateBusinessTripOtherExpense'] | void>;
};

const NOTIFICATION_ID = 'updateBusinessTripOtherExpense';

export const useUpdateBusinessTripOtherExpense = (): UseUpdateBusinessTripOtherExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const { fetching, execute } = useApiMutation({
    document: UpdateBusinessTripOtherExpenseDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Updating business trip "other" expense',
    errorMessage: 'Error updating business trip "other" expense',
    select: data => data.updateBusinessTripOtherExpense,
    successToast: { description: 'Business trip "other" expense was updated' },
  });

  return {
    fetching,
    updateBusinessTripOtherExpense: execute,
  };
};
