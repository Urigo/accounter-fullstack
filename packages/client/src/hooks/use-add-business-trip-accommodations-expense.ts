import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  AddBusinessTripAccommodationsExpenseDocument,
  AddBusinessTripAccommodationsExpenseMutation,
  AddBusinessTripAccommodationsExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripAccommodationsExpense(
    $fields: AddBusinessTripAccommodationsExpenseInput!
  ) {
    addBusinessTripAccommodationsExpense(fields: $fields)
  }
`;

type UseAddBusinessTripAccommodationsExpense = {
  fetching: boolean;
  addBusinessTripAccommodationsExpense: (
    variables: AddBusinessTripAccommodationsExpenseMutationVariables,
  ) => Promise<
    AddBusinessTripAccommodationsExpenseMutation['addBusinessTripAccommodationsExpense'] | void
  >;
};

const NOTIFICATION_ID = 'addBusinessTripAccommodationsExpense';

export const useAddBusinessTripAccommodationsExpense =
  (): UseAddBusinessTripAccommodationsExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(AddBusinessTripAccommodationsExpenseDocument);
    const addBusinessTripAccommodationsExpense = useCallback(
      async (variables: AddBusinessTripAccommodationsExpenseMutationVariables) => {
        const message = 'Error adding business trip accommodations expense';
        const notificationId = NOTIFICATION_ID;
        toast.loading('Adding Business Trip Accommodations Expense', {
          id: notificationId,
        });
        try {
          const res = await mutate(variables);
          const data = handleCommonErrors(res, message, notificationId);
          if (data) {
            toast.success('Success', {
              id: notificationId,
              description: 'Business trip accommodations expense added',
            });
            return data.addBusinessTripAccommodationsExpense;
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
      addBusinessTripAccommodationsExpense,
    };
  };
