import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import {
  UpdateTaxCategoryDocument,
  UpdateTaxCategoryMutation,
  UpdateTaxCategoryMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateTaxCategory($taxCategoryId: UUID!, $fields: UpdateTaxCategoryInput!) {
    updateTaxCategory(taxCategoryId: $taxCategoryId, fields: $fields) {
      __typename
      ... on TaxCategory {
        id
        name
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type TaxCategory = Extract<
  UpdateTaxCategoryMutation['updateTaxCategory'],
  { __typename: 'TaxCategory' }
>;

type UseUpdateTaxCategory = {
  fetching: boolean;
  updateTaxCategory: (variables: UpdateTaxCategoryMutationVariables) => Promise<TaxCategory>;
};

const NOTIFICATION_ID = 'updateTaxCategory';

export const useUpdateTaxCategory = (): UseUpdateTaxCategory => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateTaxCategoryDocument);

  return {
    fetching,
    updateTaxCategory: (variables: UpdateTaxCategoryMutationVariables): Promise<TaxCategory> =>
      new Promise<TaxCategory>((resolve, reject) => {
        notifications.show({
          id: NOTIFICATION_ID,
          loading: true,
          title: 'Uploading Documents',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        return mutate(variables).then(res => {
          if (res.error) {
            const message = 'Error updating tax category';
            console.error(`${message}: ${res.error}`);
            notifications.update({
              id: NOTIFICATION_ID,
              message,
              color: 'red',
              autoClose: 5000,
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error('Error updating tax category: No data received');
            notifications.update({
              id: NOTIFICATION_ID,
              title: 'Error updating tax category',
              message: 'No data received',
              color: 'red',
              autoClose: 5000,
            });
            return reject('No data received');
          }
          if (res.data.updateTaxCategory.__typename === 'CommonError') {
            const message = 'Error updating tax category';
            console.error(`${message}: ${res.data.updateTaxCategory.message}`);
            notifications.update({
              id: NOTIFICATION_ID,
              message,
              color: 'red',
              autoClose: 5000,
            });
            return reject(res.data.updateTaxCategory.message);
          }
          notifications.update({
            id: NOTIFICATION_ID,
            title: 'Update Successful!',
            autoClose: 5000,
            message: `${res.data.updateTaxCategory.name} was updated`,
            withCloseButton: true,
          });
          return resolve(res.data.updateTaxCategory);
        });
      }),
  };
};
