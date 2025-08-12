import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateBusinessTripOtherExpenseDocument,
  type UpdateBusinessTripOtherExpenseMutation,
  type UpdateBusinessTripOtherExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(UpdateBusinessTripOtherExpenseDocument);
  const updateBusinessTripOtherExpense = useCallback(
    async (variables: UpdateBusinessTripOtherExpenseMutationVariables) => {
      const message = 'Error updating business trip "other" expense';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Updating business trip "other" expense', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Business trip "other" expense was updated',
          });
          return data.updateBusinessTripOtherExpense;
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
    updateBusinessTripOtherExpense,
  };
};
