import {
  AddBusinessTripOtherExpenseDocument,
  type AddBusinessTripOtherExpenseMutation,
  type AddBusinessTripOtherExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: AddBusinessTripOtherExpenseDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Adding trip "other" expense',
    errorMessage: 'Error adding business trip "other" expense',
    select: data => data.addBusinessTripOtherExpense,
    successToast: { description: 'Business trip "other" expense was added' },
  });

  return {
    fetching,
    addBusinessTripOtherExpense: execute,
  };
};
