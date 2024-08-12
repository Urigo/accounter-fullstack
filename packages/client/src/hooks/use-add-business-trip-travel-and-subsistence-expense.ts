import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  AddBusinessTripTravelAndSubsistenceExpenseDocument,
  AddBusinessTripTravelAndSubsistenceExpenseMutation,
  AddBusinessTripTravelAndSubsistenceExpenseMutationVariables,
} from '../gql/graphql.js';

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
    AddBusinessTripTravelAndSubsistenceExpenseMutation['addBusinessTripTravelAndSubsistenceExpense']
  >;
};

export const useAddBusinessTripTravelAndSubsistenceExpense =
  (): UseAddBusinessTripTravelAndSubsistenceExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(AddBusinessTripTravelAndSubsistenceExpenseDocument);

    return {
      fetching,
      addBusinessTripTravelAndSubsistenceExpense: (
        variables: AddBusinessTripTravelAndSubsistenceExpenseMutationVariables,
      ): Promise<
        AddBusinessTripTravelAndSubsistenceExpenseMutation['addBusinessTripTravelAndSubsistenceExpense']
      > =>
        new Promise<
          AddBusinessTripTravelAndSubsistenceExpenseMutation['addBusinessTripTravelAndSubsistenceExpense']
        >((resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error adding business trip travel&subsistence expense: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, travel&subsistence expense was not added',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error(
                'Error adding business trip travel&subsistence expense: No data returned',
              );
              showNotification({
                title: 'Error!',
                message: 'Oops, travel&subsistence expense was not added',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Success!',
              message: 'Business trip travel&subsistence expense was added! 🎉',
            });
            return resolve(res.data.addBusinessTripTravelAndSubsistenceExpense);
          }),
        ),
    };
  };
