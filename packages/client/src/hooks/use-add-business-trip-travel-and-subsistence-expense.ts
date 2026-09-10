import {
  AddBusinessTripTravelAndSubsistenceExpenseDocument,
  type AddBusinessTripTravelAndSubsistenceExpenseMutation,
  type AddBusinessTripTravelAndSubsistenceExpenseMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripTravelAndSubsistenceExpense(
    $fields: AddBusinessTripTravelAndSubsistenceExpenseInput!
  ) {
    addBusinessTripTravelAndSubsistenceExpense(fields: $fields)
  }
`;

type UseAddBusinessTripTravelAndSubsistenceExpense = {
  fetching: boolean;
  addBusinessTripTravelAndSubsistenceExpense: (
    variables: AddBusinessTripTravelAndSubsistenceExpenseMutationVariables,
  ) => Promise<
    | AddBusinessTripTravelAndSubsistenceExpenseMutation['addBusinessTripTravelAndSubsistenceExpense']
    | void
  >;
};

const NOTIFICATION_ID = 'addBusinessTripTravelAndSubsistenceExpense';

export const useAddBusinessTripTravelAndSubsistenceExpense =
  (): UseAddBusinessTripTravelAndSubsistenceExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const { fetching, execute } = useApiMutation({
      document: AddBusinessTripTravelAndSubsistenceExpenseDocument,
      notificationId: NOTIFICATION_ID,
      loadingMessage: 'Adding trip travel&subsistence expense',
      errorMessage: 'Error adding business trip travel&subsistence expense',
      select: data => data.addBusinessTripTravelAndSubsistenceExpense,
      successToast: { description: 'Business trip travel&subsistence expense was added' },
    });

    return {
      fetching,
      addBusinessTripTravelAndSubsistenceExpense: execute,
    };
  };
