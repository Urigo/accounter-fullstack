import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateBusinessTripCarRentalExpenseDocument,
  type UpdateBusinessTripCarRentalExpenseMutation,
  type UpdateBusinessTripCarRentalExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripCarRentalExpense($fields: UpdateBusinessTripCarRentalExpenseInput!) {
    updateBusinessTripCarRentalExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripCarRentalExpense = {
  fetching: boolean;
  updateBusinessTripCarRentalExpense: (
    variables: UpdateBusinessTripCarRentalExpenseMutationVariables,
  ) => Promise<
    UpdateBusinessTripCarRentalExpenseMutation['updateBusinessTripCarRentalExpense'] | void
  >;
};

const NOTIFICATION_ID = 'updateBusinessTripCarRentalExpense';

export const useUpdateBusinessTripCarRentalExpense = (): UseUpdateBusinessTripCarRentalExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(UpdateBusinessTripCarRentalExpenseDocument);
  const updateBusinessTripCarRentalExpense = useCallback(
    async (variables: UpdateBusinessTripCarRentalExpenseMutationVariables) => {
      const message = 'Error updating business trip car rental expense';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Updating trip car rental expense', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Business trip car rental expense was updated',
          });
          return data.updateBusinessTripCarRentalExpense;
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
    updateBusinessTripCarRentalExpense,
  };
};
