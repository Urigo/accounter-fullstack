import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  AddBusinessTripCarRentalExpenseDocument,
  type AddBusinessTripCarRentalExpenseMutation,
  type AddBusinessTripCarRentalExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripCarRentalExpense($fields: AddBusinessTripCarRentalExpenseInput!) {
    addBusinessTripCarRentalExpense(fields: $fields)
  }
`;

type UseAddBusinessTripCarRentalExpense = {
  fetching: boolean;
  addBusinessTripCarRentalExpense: (
    variables: AddBusinessTripCarRentalExpenseMutationVariables,
  ) => Promise<AddBusinessTripCarRentalExpenseMutation['addBusinessTripCarRentalExpense'] | void>;
};

const NOTIFICATION_ID = 'addBusinessTripCarRentalExpense';

export const useAddBusinessTripCarRentalExpense = (): UseAddBusinessTripCarRentalExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(AddBusinessTripCarRentalExpenseDocument);
  const addBusinessTripCarRentalExpense = useCallback(
    async (variables: AddBusinessTripCarRentalExpenseMutationVariables) => {
      const message = 'Error adding business trip car rental expense';
      toast.loading('Adding car rental expense...', {
        id: NOTIFICATION_ID,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, NOTIFICATION_ID);
        if (data) {
          toast.success('Success', {
            id: NOTIFICATION_ID,
            description: 'Car rental expense added',
          });
          return data.addBusinessTripCarRentalExpense;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: NOTIFICATION_ID,
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
    addBusinessTripCarRentalExpense,
  };
};
