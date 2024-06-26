import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { graphql, ResultOf, VariablesOf } from '../graphql.js';

export const AddBusinessTripOtherTransactionDocument = graphql(`
  mutation AddBusinessTripOtherTransaction($fields: AddBusinessTripOtherTransactionInput!) {
    addBusinessTripOtherTransaction(fields: $fields)
  }
`);

type AddBusinessTripOtherTransactionMutationVariables = VariablesOf<
  typeof AddBusinessTripOtherTransactionDocument
>;
type AddBusinessTripOtherTransactionMutation = ResultOf<
  typeof AddBusinessTripOtherTransactionDocument
>;

type UseAddBusinessTripOtherTransaction = {
  fetching: boolean;
  addBusinessTripOtherTransaction: (
    variables: AddBusinessTripOtherTransactionMutationVariables,
  ) => Promise<AddBusinessTripOtherTransactionMutation['addBusinessTripOtherTransaction']>;
};

export const useAddBusinessTripOtherTransaction = (): UseAddBusinessTripOtherTransaction => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(AddBusinessTripOtherTransactionDocument);

  return {
    fetching,
    addBusinessTripOtherTransaction: (
      variables: AddBusinessTripOtherTransactionMutationVariables,
    ): Promise<AddBusinessTripOtherTransactionMutation['addBusinessTripOtherTransaction']> =>
      new Promise<AddBusinessTripOtherTransactionMutation['addBusinessTripOtherTransaction']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error adding business trip "other" transaction: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, "other" transaction was not added',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error adding business trip "other" transaction: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, "other" transaction was not added',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Success!',
              message: 'Business trip "other" transaction was added! 🎉',
            });
            return resolve(res.data.addBusinessTripOtherTransaction);
          }),
      ),
  };
};
