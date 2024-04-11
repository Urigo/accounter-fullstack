import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateBusinessTripTransactionCategoryDocument,
  UpdateBusinessTripTransactionCategoryMutation,
  UpdateBusinessTripTransactionCategoryMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripTransactionCategory($fields: UpdateBusinessTripTransactionCategoryInput!) {
    updateBusinessTripTransactionCategory(fields: $fields)
  }
`;

type UseUpdateBusinessTripTransactionCategory = {
  fetching: boolean;
  updateBusinessTripTransactionCategory: (
    variables: UpdateBusinessTripTransactionCategoryMutationVariables,
  ) => Promise<
    UpdateBusinessTripTransactionCategoryMutation['updateBusinessTripTransactionCategory']
  >;
};

export const useUpdateBusinessTripTransactionCategory =
  (): UseUpdateBusinessTripTransactionCategory => {
    // TODO: add authentication
    // TODO: add local data update method after update

    const [{ fetching }, mutate] = useMutation(UpdateBusinessTripTransactionCategoryDocument);

    return {
      fetching,
      updateBusinessTripTransactionCategory: (
        variables: UpdateBusinessTripTransactionCategoryMutationVariables,
      ): Promise<
        UpdateBusinessTripTransactionCategoryMutation['updateBusinessTripTransactionCategory']
      > =>
        new Promise<
          UpdateBusinessTripTransactionCategoryMutation['updateBusinessTripTransactionCategory']
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
            return resolve(res.data.updateBusinessTripTransactionCategory);
          }),
        ),
    };
  };
