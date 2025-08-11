import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  DeleteBusinessTripExpenseDocument,
  type DeleteBusinessTripExpenseMutation,
  type DeleteBusinessTripExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(DeleteBusinessTripExpenseDocument);
  const deleteBusinessTripExpense = useCallback(
    async (variables: DeleteBusinessTripExpenseMutationVariables) => {
      const message = 'Error deleting business trip expense';
      const notificationId = `${NOTIFICATION_ID}-${variables.businessTripExpenseId}`;
      toast.loading('Deleting trip expense', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Business trip expense was deleted',
          });
          return data.deleteBusinessTripExpense;
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
    deleteBusinessTripExpense,
  };
};
