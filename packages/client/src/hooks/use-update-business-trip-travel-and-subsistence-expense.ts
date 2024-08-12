import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateBusinessTripTravelAndSubsistenceExpenseDocument,
  UpdateBusinessTripTravelAndSubsistenceExpenseMutation,
  UpdateBusinessTripTravelAndSubsistenceExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripTravelAndSubsistenceExpense(
    $fields: UpdateBusinessTripTravelAndSubsistenceExpenseInput!
  ) {
    updateBusinessTripTravelAndSubsistenceExpense(fields: $fields)
  }
`;

type UseUpdateBusinessTripTravelAndSubsistenceExpense = {
  fetching: boolean;
  updateBusinessTripTravelAndSubsistenceExpense: (
    variables: UpdateBusinessTripTravelAndSubsistenceExpenseMutationVariables,
  ) => Promise<
    UpdateBusinessTripTravelAndSubsistenceExpenseMutation['updateBusinessTripTravelAndSubsistenceExpense']
  >;
};

export const useUpdateBusinessTripTravelAndSubsistenceExpense =
  (): UseUpdateBusinessTripTravelAndSubsistenceExpense => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(
      UpdateBusinessTripTravelAndSubsistenceExpenseDocument,
    );

    return {
      fetching,
      updateBusinessTripTravelAndSubsistenceExpense: (
        variables: UpdateBusinessTripTravelAndSubsistenceExpenseMutationVariables,
      ): Promise<
        UpdateBusinessTripTravelAndSubsistenceExpenseMutation['updateBusinessTripTravelAndSubsistenceExpense']
      > =>
        new Promise<
          UpdateBusinessTripTravelAndSubsistenceExpenseMutation['updateBusinessTripTravelAndSubsistenceExpense']
        >((resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(
                `Error updating business trip travel&subsistence expense: ${res.error}`,
              );
              showNotification({
                title: 'Error!',
                message: 'Oops, travel&subsistence expense was not updated',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error(
                'Error updating business trip travel&subsistence expense: No data returned',
              );
              showNotification({
                title: 'Error!',
                message: 'Oops, travel&subsistence expense was not updated',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Update Success!',
              message: 'Business trip travel&subsistence expense was updated! 🎉',
            });
            return resolve(res.data.updateBusinessTripTravelAndSubsistenceExpense);
          }),
        ),
    };
  };
