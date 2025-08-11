import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateBusinessTripFlightsExpenseDocument,
  type UpdateBusinessTripFlightsExpenseMutation,
  type UpdateBusinessTripFlightsExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripFlightsExpense($fields: UpdateBusinessTripFlightsExpenseInput!) {
    updateBusinessTripFlightsExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripFlightsExpense = {
  fetching: boolean;
  updateBusinessTripFlightsExpense: (
    variables: UpdateBusinessTripFlightsExpenseMutationVariables,
  ) => Promise<UpdateBusinessTripFlightsExpenseMutation['updateBusinessTripFlightsExpense'] | void>;
};

const NOTIFICATION_ID = 'updateBusinessTripFlightsExpense';

export const useUpdateBusinessTripFlightsExpense = (): UseUpdateBusinessTripFlightsExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(UpdateBusinessTripFlightsExpenseDocument);
  const updateBusinessTripFlightsExpense = useCallback(
    async (variables: UpdateBusinessTripFlightsExpenseMutationVariables) => {
      const message = 'Error updating business trip flights expense';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Updating trip flights expense', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Business trip flights expense was updated',
          });
          return data.updateBusinessTripFlightsExpense;
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
    updateBusinessTripFlightsExpense,
  };
};
