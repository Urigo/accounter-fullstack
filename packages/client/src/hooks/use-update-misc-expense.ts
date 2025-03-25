import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateMiscExpenseDocument,
  UpdateMiscExpenseMutation,
  UpdateMiscExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(UpdateMiscExpenseDocument);
  const updateMiscExpense = useCallback(
    async (variables: UpdateMiscExpenseMutationVariables) => {
      const message = `Error updating misc expense ID [${variables.id}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.id}`;
      toast.loading('Update Misc Expense', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateMiscExpense');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Misc expense was updated',
          });
          return data.updateMiscExpense;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    updateMiscExpense,
  };
};
