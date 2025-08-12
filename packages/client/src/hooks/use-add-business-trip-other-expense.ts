import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  AddBusinessTripOtherExpenseDocument,
  type AddBusinessTripOtherExpenseMutation,
  type AddBusinessTripOtherExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripOtherExpense($fields: AddBusinessTripOtherExpenseInput!) {
    addBusinessTripOtherExpense(fields: $fields)
  }
`;

type UseAddBusinessTripOtherExpense = {
  fetching: boolean;
  addBusinessTripOtherExpense: (
    variables: AddBusinessTripOtherExpenseMutationVariables,
  ) => Promise<AddBusinessTripOtherExpenseMutation['addBusinessTripOtherExpense'] | void>;
};

const NOTIFICATION_ID = 'addBusinessTripOtherExpense';

export const useAddBusinessTripOtherExpense = (): UseAddBusinessTripOtherExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(AddBusinessTripOtherExpenseDocument);
  const addBusinessTripOtherExpense = useCallback(
    async (variables: AddBusinessTripOtherExpenseMutationVariables) => {
      const message = 'Error adding business trip "other" expense';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Adding trip "other" expense', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Business trip "other" expense was added',
          });
          return data.addBusinessTripOtherExpense;
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
    addBusinessTripOtherExpense,
  };
};
