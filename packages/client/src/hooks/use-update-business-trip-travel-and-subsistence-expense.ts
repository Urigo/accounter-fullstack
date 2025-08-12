import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateBusinessTripTravelAndSubsistenceExpenseDocument,
  type UpdateBusinessTripTravelAndSubsistenceExpenseMutation,
  type UpdateBusinessTripTravelAndSubsistenceExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripTravelAndSubsistenceExpense(
    $fields: UpdateBusinessTripTravelAndSubsistenceExpenseInput!
  ) {
    updateBusinessTripTravelAndSubsistenceExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripTravelAndSubsistenceExpense = {
  fetching: boolean;
  updateBusinessTripTravelAndSubsistenceExpense: (
    variables: UpdateBusinessTripTravelAndSubsistenceExpenseMutationVariables,
  ) => Promise<
    | UpdateBusinessTripTravelAndSubsistenceExpenseMutation['updateBusinessTripTravelAndSubsistenceExpense']
    | void
  >;
};

const NOTIFICATION_ID = 'updateBusinessTripTravelAndSubsistenceExpense';

export const useUpdateBusinessTripTravelAndSubsistenceExpense =
  (): UseUpdateBusinessTripTravelAndSubsistenceExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(
      UpdateBusinessTripTravelAndSubsistenceExpenseDocument,
    );
    const updateBusinessTripTravelAndSubsistenceExpense = useCallback(
      async (variables: UpdateBusinessTripTravelAndSubsistenceExpenseMutationVariables) => {
        const message = 'Error updating business trip travel&subsistence expense';
        const notificationId = NOTIFICATION_ID;
        toast.loading('Updating trip travel&subsistence expense', {
          id: notificationId,
        });
        try {
          const res = await mutate(variables);
          const data = handleCommonErrors(res, message, notificationId);
          if (data) {
            toast.success('Success', {
              id: notificationId,
              description: 'Business trip travel&subsistence expense was updated',
            });
            return data.updateBusinessTripTravelAndSubsistenceExpense;
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
      updateBusinessTripTravelAndSubsistenceExpense,
    };
  };
