import {
  DeleteMiscExpenseDocument,
  type DeleteMiscExpenseMutation,
  type DeleteMiscExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteMiscExpense($id: UUID!) {
    deleteMiscExpense(id: $id)
  }
`;

type UseDeleteMiscExpense = {
  fetching: boolean;
  deleteMiscExpense: (
    variables: DeleteMiscExpenseMutationVariables,
  ) => Promise<DeleteMiscExpenseMutation['deleteMiscExpense'] | void>;
};

const NOTIFICATION_ID = 'deleteMiscExpense';

export const useDeleteMiscExpense = (): UseDeleteMiscExpense => {
  // TODO: add authentication
  // TODO: add local data update method after deletion

  const { fetching, execute } = useApiMutation({
    document: DeleteMiscExpenseDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.id}`,
    loadingMessage: 'Deleting misc expense',
    errorMessage: 'Error deleting misc expense',
    select: data => data.deleteMiscExpense,
    successToast: { description: 'Misc expense was deleted successfully' },
  });

  return {
    fetching,
    deleteMiscExpense: execute,
  };
};
