import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  CategorizeIntoExistingBusinessTripTransactionDocument,
  CategorizeIntoExistingBusinessTripTransactionMutation,
  CategorizeIntoExistingBusinessTripTransactionMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CategorizeIntoExistingBusinessTripTransaction(
    $fields: CategorizeIntoExistingBusinessTripTransactionInput!
  ) {
    categorizeIntoExistingBusinessTripTransaction(fields: $fields)
  }
`;

type UseCategorizeIntoExistingBusinessTripTransaction = {
  fetching: boolean;
  categorizeIntoExistingBusinessTripTransaction: (
    variables: CategorizeIntoExistingBusinessTripTransactionMutationVariables,
  ) => Promise<
    CategorizeIntoExistingBusinessTripTransactionMutation['categorizeIntoExistingBusinessTripTransaction']
  >;
};

export const useCategorizeIntoExistingBusinessTripTransaction =
  (): UseCategorizeIntoExistingBusinessTripTransaction => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(
      CategorizeIntoExistingBusinessTripTransactionDocument,
    );

    return {
      fetching,
      categorizeIntoExistingBusinessTripTransaction: (
        variables: CategorizeIntoExistingBusinessTripTransactionMutationVariables,
      ): Promise<
        CategorizeIntoExistingBusinessTripTransactionMutation['categorizeIntoExistingBusinessTripTransaction']
      > =>
        new Promise<
          CategorizeIntoExistingBusinessTripTransactionMutation['categorizeIntoExistingBusinessTripTransaction']
        >((resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error updating business trip transaction category: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, transaction category was not updated',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error updating business trip transaction category: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, transaction category was not updated',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Update Success!',
              message: 'Business trip transaction category was updated! 🎉',
            });
            return resolve(res.data.categorizeIntoExistingBusinessTripTransaction);
          }),
        ),
    };
  };
