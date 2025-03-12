import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  CategorizeIntoExistingBusinessTripExpenseDocument,
  CategorizeIntoExistingBusinessTripExpenseMutation,
  CategorizeIntoExistingBusinessTripExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CategorizeIntoExistingBusinessTripExpense(
    $fields: CategorizeIntoExistingBusinessTripExpenseInput!
  ) {
    categorizeIntoExistingBusinessTripExpense(fields: $fields)
  }
`;

type UseCategorizeIntoExistingBusinessTripExpense = {
  fetching: boolean;
  categorizeIntoExistingBusinessTripExpense: (
    variables: CategorizeIntoExistingBusinessTripExpenseMutationVariables,
  ) => Promise<
    | CategorizeIntoExistingBusinessTripExpenseMutation['categorizeIntoExistingBusinessTripExpense']
    | void
  >;
};

const NOTIFICATION_ID = 'categorizeIntoExistingBusinessTripExpense';

export const useCategorizeIntoExistingBusinessTripExpense =
  (): UseCategorizeIntoExistingBusinessTripExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(CategorizeIntoExistingBusinessTripExpenseDocument);
    const categorizeIntoExistingBusinessTripExpense = useCallback(
      async (variables: CategorizeIntoExistingBusinessTripExpenseMutationVariables) => {
        const message = 'Error updating business trip expense category';
        const notificationId = NOTIFICATION_ID;
        toast.loading('Updating business trip expense category', {
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
            return data.categorizeIntoExistingBusinessTripExpense;
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
      categorizeIntoExistingBusinessTripExpense,
    };
  };
