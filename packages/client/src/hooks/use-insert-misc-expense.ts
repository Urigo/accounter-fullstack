import {
  InsertMiscExpenseDocument,
  type InsertMiscExpenseMutation,
  type InsertMiscExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: InsertMiscExpenseDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.chargeId}`,
    loadingMessage: 'Creating misc expense',
    errorMessage: 'Error creating misc expense',
    select: data => data.insertMiscExpense,
    successToast: { description: 'Misc expense was created' },
  });

  return {
    fetching,
    insertMiscExpense: execute,
  };
};
