import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { graphql, ResultOf, VariablesOf } from '../graphql.js';

export const DeleteBusinessTripTransactionDocument = graphql(`
  mutation DeleteBusinessTripTransaction($businessTripTransactionId: UUID!) {
    deleteBusinessTripTransaction(businessTripTransactionId: $businessTripTransactionId)
  }
`);

type DeleteBusinessTripTransactionMutationVariables = VariablesOf<
  typeof DeleteBusinessTripTransactionDocument
>;
type DeleteBusinessTripTransactionMutation = ResultOf<typeof DeleteBusinessTripTransactionDocument>;

type UseDeleteBusinessTripTransaction = {
  fetching: boolean;
  deleteBusinessTripTransaction: (
    variables: DeleteBusinessTripTransactionMutationVariables,
  ) => Promise<DeleteBusinessTripTransactionMutation['deleteBusinessTripTransaction']>;
};

export const useDeleteBusinessTripTransaction = (): UseDeleteBusinessTripTransaction => {
  // TODO: add authentication
  // TODO: add local data delete method after delete

  const [{ fetching }, mutate] = useMutation(DeleteBusinessTripTransactionDocument);

  return {
    fetching,
    deleteBusinessTripTransaction: (
      variables: DeleteBusinessTripTransactionMutationVariables,
    ): Promise<DeleteBusinessTripTransactionMutation['deleteBusinessTripTransaction']> =>
      new Promise<DeleteBusinessTripTransactionMutation['deleteBusinessTripTransaction']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error deleting business trip transaction: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, transaction was not deleted',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error deleting business trip transaction: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, transaction was not deleted',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Removal Success!',
              message: 'Business trip transaction was deleted! 🎉',
            });
            return resolve(res.data.deleteBusinessTripTransaction);
          }),
      ),
  };
};
