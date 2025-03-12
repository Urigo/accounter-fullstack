import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  AddBusinessTripTravelAndSubsistenceExpenseDocument,
  AddBusinessTripTravelAndSubsistenceExpenseMutation,
  AddBusinessTripTravelAndSubsistenceExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripTravelAndSubsistenceExpense(
    $fields: AddBusinessTripTravelAndSubsistenceExpenseInput!
  ) {
    addBusinessTripTravelAndSubsistenceExpense(fields: $fields)
  }
`;

type UseAddBusinessTripTravelAndSubsistenceExpense = {
  fetching: boolean;
  addBusinessTripTravelAndSubsistenceExpense: (
    variables: AddBusinessTripTravelAndSubsistenceExpenseMutationVariables,
  ) => Promise<
    | AddBusinessTripTravelAndSubsistenceExpenseMutation['addBusinessTripTravelAndSubsistenceExpense']
    | void
  >;
};

const NOTIFICATION_ID = 'addBusinessTripTravelAndSubsistenceExpense';

export const useAddBusinessTripTravelAndSubsistenceExpense =
  (): UseAddBusinessTripTravelAndSubsistenceExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(AddBusinessTripTravelAndSubsistenceExpenseDocument);
    const addBusinessTripTravelAndSubsistenceExpense = useCallback(
      async (variables: AddBusinessTripTravelAndSubsistenceExpenseMutationVariables) => {
        const message = 'Error adding business trip travel&subsistence expense';
        const notificationId = NOTIFICATION_ID;
        toast.loading('Adding trip travel&subsistence expense', {
          id: notificationId,
        });
        try {
          const res = await mutate(variables);
          const data = handleCommonErrors(res, message, notificationId);
          if (data) {
            toast.success('Success', {
              id: notificationId,
              description: 'Business trip travel&subsistence expense was added',
            });
            return data.addBusinessTripTravelAndSubsistenceExpense;
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
      addBusinessTripTravelAndSubsistenceExpense,
    };
  };
