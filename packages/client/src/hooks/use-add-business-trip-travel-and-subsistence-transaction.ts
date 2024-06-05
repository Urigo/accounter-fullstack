import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { graphql, ResultOf, VariablesOf } from '../graphql.js';

export const AddBusinessTripTravelAndSubsistenceTransactionDocument = graphql(`
  mutation AddBusinessTripTravelAndSubsistenceTransaction(
    $fields: AddBusinessTripTravelAndSubsistenceTransactionInput!
  ) {
    addBusinessTripTravelAndSubsistenceTransaction(fields: $fields)
  }
`);

type AddBusinessTripTravelAndSubsistenceTransactionMutationVariables = VariablesOf<
  typeof AddBusinessTripTravelAndSubsistenceTransactionDocument
>;
type AddBusinessTripTravelAndSubsistenceTransactionMutation = ResultOf<
  typeof AddBusinessTripTravelAndSubsistenceTransactionDocument
>;

type UseAddBusinessTripTravelAndSubsistenceTransaction = {
  fetching: boolean;
  addBusinessTripTravelAndSubsistenceTransaction: (
    variables: AddBusinessTripTravelAndSubsistenceTransactionMutationVariables,
  ) => Promise<
    AddBusinessTripTravelAndSubsistenceTransactionMutation['addBusinessTripTravelAndSubsistenceTransaction']
  >;
};

export const useAddBusinessTripTravelAndSubsistenceTransaction =
  (): UseAddBusinessTripTravelAndSubsistenceTransaction => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(
      AddBusinessTripTravelAndSubsistenceTransactionDocument,
    );

    return {
      fetching,
      addBusinessTripTravelAndSubsistenceTransaction: (
        variables: AddBusinessTripTravelAndSubsistenceTransactionMutationVariables,
      ): Promise<
        AddBusinessTripTravelAndSubsistenceTransactionMutation['addBusinessTripTravelAndSubsistenceTransaction']
      > =>
        new Promise<
          AddBusinessTripTravelAndSubsistenceTransactionMutation['addBusinessTripTravelAndSubsistenceTransaction']
        >((resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(
                `Error adding business trip travel&subsistence transaction: ${res.error}`,
              );
              showNotification({
                title: 'Error!',
                message: 'Oops, travel&subsistence transaction was not added',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error(
                'Error adding business trip travel&subsistence transaction: No data returned',
              );
              showNotification({
                title: 'Error!',
                message: 'Oops, travel&subsistence transaction was not added',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Success!',
              message: 'Business trip travel&subsistence transaction was added! 🎉',
            });
            return resolve(res.data.addBusinessTripTravelAndSubsistenceTransaction);
          }),
        ),
    };
  };
