import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateBusinessTripOtherTransactionDocument,
  UpdateBusinessTripOtherTransactionMutation,
  UpdateBusinessTripOtherTransactionMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripOtherTransaction($fields: UpdateBusinessTripOtherTransactionInput!) {
    updateBusinessTripOtherTransaction(fields: $fields)
  }
`;

type UseUpdateBusinessTripOtherTransaction = {
  fetching: boolean;
  updateBusinessTripOtherTransaction: (
    variables: UpdateBusinessTripOtherTransactionMutationVariables,
  ) => Promise<UpdateBusinessTripOtherTransactionMutation['updateBusinessTripOtherTransaction']>;
};

export const useUpdateBusinessTripOtherTransaction = (): UseUpdateBusinessTripOtherTransaction => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(UpdateBusinessTripOtherTransactionDocument);

  return {
    fetching,
    updateBusinessTripOtherTransaction: (
      variables: UpdateBusinessTripOtherTransactionMutationVariables,
    ): Promise<UpdateBusinessTripOtherTransactionMutation['updateBusinessTripOtherTransaction']> =>
      new Promise<UpdateBusinessTripOtherTransactionMutation['updateBusinessTripOtherTransaction']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error updating business trip "other" transaction: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, "other" transaction was not updated',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error updating business trip "other" transaction: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, "other" transaction was not updated',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Update Success!',
              message: 'Business trip "other" transaction was updated! 🎉',
            });
            return resolve(res.data.updateBusinessTripOtherTransaction);
          }),
      ),
  };
};
