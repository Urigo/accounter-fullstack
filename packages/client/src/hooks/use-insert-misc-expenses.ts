import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  InsertMiscExpensesDocument,
  type InsertMiscExpensesMutation,
  type InsertMiscExpensesMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertMiscExpenses($chargeId: UUID!, $expenses: [InsertMiscExpenseInput!]!) {
    insertMiscExpenses(chargeId: $chargeId, expenses: $expenses) {
      id
    }
  }
`;

type UseInsertMiscExpenses = {
  fetching: boolean;
  insertMiscExpenses: (
    variables: InsertMiscExpensesMutationVariables,
  ) => Promise<InsertMiscExpensesMutation['insertMiscExpenses'] | void>;
};

const NOTIFICATION_ID = 'insertMiscExpenses';

export const useInsertMiscExpenses = (): UseInsertMiscExpenses => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertMiscExpensesDocument);
  const insertMiscExpenses = useCallback(
    async (variables: InsertMiscExpensesMutationVariables) => {
      const message = 'Error creating misc expense';
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      toast.loading('Inserting misc expenses', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Misc expenses were added',
          });
          return data.insertMiscExpenses;
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
    insertMiscExpenses,
  };
};
