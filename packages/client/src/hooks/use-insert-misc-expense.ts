import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  InsertMiscExpenseDocument,
  InsertMiscExpenseMutation,
  InsertMiscExpenseMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertMiscExpense($chargeId: UUID!, $fields: InsertMiscExpenseInput!) {
    insertMiscExpense(chargeId: $chargeId, fields: $fields) {
      id
    }
  }
`;

type UseInsertMiscExpense = {
  fetching: boolean;
  insertMiscExpense: (
    variables: InsertMiscExpenseMutationVariables,
  ) => Promise<InsertMiscExpenseMutation['insertMiscExpense'] | void>;
};

const NOTIFICATION_ID = 'insertMiscExpense';

export const useInsertMiscExpense = (): UseInsertMiscExpense => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertMiscExpenseDocument);
  const insertMiscExpense = useCallback(
    async (variables: InsertMiscExpenseMutationVariables) => {
      const message = 'Error creating misc expense';
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      toast.loading('Creating misc expense', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Misc expense was created',
          });
          return data.insertMiscExpense;
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
    insertMiscExpense,
  };
};
