import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  CategorizeBusinessTripExpenseDocument,
  CategorizeBusinessTripExpenseMutation,
  CategorizeBusinessTripExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CategorizeBusinessTripExpense($fields: CategorizeBusinessTripExpenseInput!) {
    categorizeBusinessTripExpense(fields: $fields)
  }
`;

type UseCategorizeBusinessTripExpense = {
  fetching: boolean;
  categorizeBusinessTripExpense: (
    variables: CategorizeBusinessTripExpenseMutationVariables,
  ) => Promise<CategorizeBusinessTripExpenseMutation['categorizeBusinessTripExpense'] | void>;
};

const NOTIFICATION_ID = 'categorizeBusinessTripExpense';

export const useCategorizeBusinessTripExpense = (): UseCategorizeBusinessTripExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(CategorizeBusinessTripExpenseDocument);
  const categorizeBusinessTripExpense = useCallback(
    async (variables: CategorizeBusinessTripExpenseMutationVariables) => {
      const message = 'Error updating business trip expense category';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Updating trip expense category', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Business trip expense category was updated',
          });
          return data.categorizeBusinessTripExpense;
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
    categorizeBusinessTripExpense,
  };
};
