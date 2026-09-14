import {
  InsertMiscExpensesDocument,
  type InsertMiscExpensesMutation,
  type InsertMiscExpensesMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: InsertMiscExpensesDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.chargeId}`,
    loadingMessage: 'Inserting misc expenses',
    errorMessage: 'Error creating misc expense',
    select: data => data.insertMiscExpenses,
    successToast: { description: 'Misc expenses were added' },
  });

  return {
    fetching,
    insertMiscExpenses: execute,
  };
};
