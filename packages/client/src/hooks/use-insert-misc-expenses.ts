import { useCallback } from 'react';
import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import {
  InsertMiscExpensesDocument,
  InsertMiscExpensesMutation,
  InsertMiscExpensesMutationVariables,
} from '../gql/graphql.js';
import { useHandleKnownErrors } from './use-handle-known-errors.js';

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
  ) => Promise<InsertMiscExpensesMutation['insertMiscExpenses']>;
};

const NOTIFICATION_ID = 'insertMiscExpenses';

export const useInsertMiscExpenses = (): UseInsertMiscExpenses => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertMiscExpensesDocument);
  const { handleKnownErrors } = useHandleKnownErrors();

  const insertMiscExpenses = useCallback(
    async (
      variables: InsertMiscExpensesMutationVariables,
    ): Promise<InsertMiscExpensesMutation['insertMiscExpenses']> => {
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;

      return new Promise<InsertMiscExpensesMutation['insertMiscExpenses']>((resolve, reject) => {
        notifications.show({
          id: notificationId,
          loading: true,
          title: 'Inserting misc expenses',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        return mutate(variables).then(res => {
          const message = 'Error creating misc expense';
          const data = handleKnownErrors(res, reject, message, notificationId);
          if (!data) {
            return;
          }
          notifications.update({
            id: notificationId,
            title: 'Insert Successful!',
            autoClose: 5000,
            message: 'Misc expenses were added',
            withCloseButton: true,
          });
          return resolve(data.insertMiscExpenses);
        });
      });
    },
    [mutate, handleKnownErrors],
  );

  return {
    fetching,
    insertMiscExpenses,
  };
};
