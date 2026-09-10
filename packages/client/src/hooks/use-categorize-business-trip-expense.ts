import {
  CategorizeBusinessTripExpenseDocument,
  type CategorizeBusinessTripExpenseMutation,
  type CategorizeBusinessTripExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: CategorizeBusinessTripExpenseDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Updating trip expense category',
    errorMessage: 'Error updating business trip expense category',
    select: data => data.categorizeBusinessTripExpense,
    successToast: { description: 'Business trip expense category was updated' },
  });

  return {
    fetching,
    categorizeBusinessTripExpense: execute,
  };
};
