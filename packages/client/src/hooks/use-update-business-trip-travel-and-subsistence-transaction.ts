import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { graphql, ResultOf, VariablesOf } from '../graphql.js';

export const UpdateBusinessTripTravelAndSubsistenceTransactionDocument = graphql(`
  mutation UpdateBusinessTripTravelAndSubsistenceTransaction(
    $fields: UpdateBusinessTripTravelAndSubsistenceTransactionInput!
  ) {
    updateBusinessTripTravelAndSubsistenceTransaction(fields: $fields)
  }
`);

type UpdateBusinessTripTravelAndSubsistenceTransactionMutationVariables = VariablesOf<
  typeof UpdateBusinessTripTravelAndSubsistenceTransactionDocument
>;
type UpdateBusinessTripTravelAndSubsistenceTransactionMutation = ResultOf<
  typeof UpdateBusinessTripTravelAndSubsistenceTransactionDocument
>;

type UseUpdateBusinessTripTravelAndSubsistenceTransaction = {
  fetching: boolean;
  updateBusinessTripTravelAndSubsistenceTransaction: (
    variables: UpdateBusinessTripTravelAndSubsistenceTransactionMutationVariables,
  ) => Promise<
    UpdateBusinessTripTravelAndSubsistenceTransactionMutation['updateBusinessTripTravelAndSubsistenceTransaction']
  >;
};

export const useUpdateBusinessTripTravelAndSubsistenceTransaction =
  (): UseUpdateBusinessTripTravelAndSubsistenceTransaction => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(
      UpdateBusinessTripTravelAndSubsistenceTransactionDocument,
    );

    return {
      fetching,
      updateBusinessTripTravelAndSubsistenceTransaction: (
        variables: UpdateBusinessTripTravelAndSubsistenceTransactionMutationVariables,
      ): Promise<
        UpdateBusinessTripTravelAndSubsistenceTransactionMutation['updateBusinessTripTravelAndSubsistenceTransaction']
      > =>
        new Promise<
          UpdateBusinessTripTravelAndSubsistenceTransactionMutation['updateBusinessTripTravelAndSubsistenceTransaction']
        >((resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(
                `Error updating business trip travel&subsistence transaction: ${res.error}`,
              );
              showNotification({
                title: 'Error!',
                message: 'Oops, travel&subsistence transaction was not updated',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error(
                'Error updating business trip travel&subsistence transaction: No data returned',
              );
              showNotification({
                title: 'Error!',
                message: 'Oops, travel&subsistence transaction was not updated',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Update Success!',
              message: 'Business trip travel&subsistence transaction was updated! 🎉',
            });
            return resolve(res.data.updateBusinessTripTravelAndSubsistenceTransaction);
          }),
        ),
    };
  };
