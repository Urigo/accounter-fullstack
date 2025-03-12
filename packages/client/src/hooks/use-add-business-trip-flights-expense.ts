import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  AddBusinessTripFlightsExpenseDocument,
  AddBusinessTripFlightsExpenseMutation,
  AddBusinessTripFlightsExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripFlightsExpense($fields: AddBusinessTripFlightsExpenseInput!) {
    addBusinessTripFlightsExpense(fields: $fields)
  }
`;

type UseAddBusinessTripFlightsExpense = {
  fetching: boolean;
  addBusinessTripFlightsExpense: (
    variables: AddBusinessTripFlightsExpenseMutationVariables,
  ) => Promise<AddBusinessTripFlightsExpenseMutation['addBusinessTripFlightsExpense'] | void>;
};

const NOTIFICATION_ID = 'addBusinessTripFlightsExpense';

export const useAddBusinessTripFlightsExpense = (): UseAddBusinessTripFlightsExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(AddBusinessTripFlightsExpenseDocument);
  const addBusinessTripFlightsExpense = useCallback(
    async (variables: AddBusinessTripFlightsExpenseMutationVariables) => {
      const message = 'Error adding business trip flight expense';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Adding business trip flight expense', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Business trip flight expense added',
          });
          return data.addBusinessTripFlightsExpense;
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
    addBusinessTripFlightsExpense,
  };
};
