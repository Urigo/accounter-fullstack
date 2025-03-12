import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateBusinessTripAccommodationsExpenseDocument,
  UpdateBusinessTripAccommodationsExpenseMutation,
  UpdateBusinessTripAccommodationsExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripAccommodationsExpense(
    $fields: UpdateBusinessTripAccommodationsExpenseInput!
  ) {
    updateBusinessTripAccommodationsExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripAccommodationsExpense = {
  fetching: boolean;
  updateBusinessTripAccommodationsExpense: (
    variables: UpdateBusinessTripAccommodationsExpenseMutationVariables,
  ) => Promise<
    | UpdateBusinessTripAccommodationsExpenseMutation['updateBusinessTripAccommodationsExpense']
    | void
  >;
};

const NOTIFICATION_ID = 'updateBusinessTripAccommodationsExpense';

export const useUpdateBusinessTripAccommodationsExpense =
  (): UseUpdateBusinessTripAccommodationsExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(UpdateBusinessTripAccommodationsExpenseDocument);
    const updateBusinessTripAccommodationsExpense = useCallback(
      async (variables: UpdateBusinessTripAccommodationsExpenseMutationVariables) => {
        const message = 'Error updating business trip accommodations expense';
        const notificationId = NOTIFICATION_ID;
        toast.loading('Updating trip accommodations expense', {
          id: notificationId,
        });
        try {
          const res = await mutate(variables);
          const data = handleCommonErrors(res, message, notificationId);
          if (data) {
            toast.success('Success', {
              id: notificationId,
              description: 'Business trip accommodations expense was updated',
            });
            return data.updateBusinessTripAccommodationsExpense;
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
      updateBusinessTripAccommodationsExpense,
    };
  };
