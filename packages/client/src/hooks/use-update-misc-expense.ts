import {
  UpdateMiscExpenseDocument,
  type UpdateMiscExpenseMutation,
  type UpdateMiscExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateMiscExpense($id: UUID!, $fields: UpdateMiscExpenseInput!) {
    updateMiscExpense(id: $id, fields: $fields) {
      id
    }
  }
`;

type UseUpdateMiscExpense = {
  fetching: boolean;
  updateMiscExpense: (
    variables: UpdateMiscExpenseMutationVariables,
  ) => Promise<UpdateMiscExpenseMutation['updateMiscExpense'] | void>;
};

const NOTIFICATION_ID = 'updateMiscExpense';

export const useUpdateMiscExpense = (): UseUpdateMiscExpense => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: UpdateMiscExpenseDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.id}`,
    loadingMessage: 'Update Misc Expense',
    errorMessage: variables => `Error updating misc expense ID [${variables.id}]`,
    commonErrorPath: 'updateMiscExpense',
    select: data => data.updateMiscExpense,
    successToast: { description: 'Misc expense was updated' },
  });

  return {
    fetching,
    updateMiscExpense: execute,
  };
};
