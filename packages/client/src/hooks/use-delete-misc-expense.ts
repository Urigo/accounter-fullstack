import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  DeleteMiscExpenseDocument,
  type DeleteMiscExpenseMutation,
  type DeleteMiscExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(DeleteMiscExpenseDocument);
  const deleteMiscExpense = useCallback(
    async (variables: DeleteMiscExpenseMutationVariables) => {
      const message = 'Error deleting misc expense';
      const notificationId = `${NOTIFICATION_ID}-${variables.id}`;
      toast.loading('Deleting misc expense', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Misc expense was deleted successfully',
          });
          return data.deleteMiscExpense;
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
    deleteMiscExpense,
  };
};
