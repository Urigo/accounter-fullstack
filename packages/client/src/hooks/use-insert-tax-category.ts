import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import {
  InsertTaxCategoryDocument,
  InsertTaxCategoryMutation,
  InsertTaxCategoryMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertTaxCategory($fields: InsertTaxCategoryInput!) {
    insertTaxCategory(fields: $fields) {
      id
      name
    }
  }
`;

type InsertTaxCategorySuccessfulResult = InsertTaxCategoryMutation['insertTaxCategory'];

type UseInsertTaxCategory = {
  fetching: boolean;
  insertTaxCategory: (
    variables: InsertTaxCategoryMutationVariables,
  ) => Promise<InsertTaxCategorySuccessfulResult>;
};

const NOTIFICATION_ID = 'insertTaxCategory';

export const useInsertTaxCategory = (): UseInsertTaxCategory => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertTaxCategoryDocument);

  return {
    fetching,
    insertTaxCategory: (
      variables: InsertTaxCategoryMutationVariables,
    ): Promise<InsertTaxCategorySuccessfulResult> =>
      new Promise<InsertTaxCategorySuccessfulResult>((resolve, reject) => {
        notifications.show({
          id: NOTIFICATION_ID,
          loading: true,
          title: 'Adding Tax Category',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        return mutate(variables).then(res => {
          if (res.error) {
            const message = 'Error creating tax category';
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
            console.error('Error creating tax category: No data received');
            notifications.update({
              id: NOTIFICATION_ID,
              title: 'Error creating tax category',
              message: 'No data received',
              color: 'red',
              autoClose: 5000,
            });
            return reject('No data received');
          }
          notifications.update({
            id: NOTIFICATION_ID,
            title: 'Creation Successful!',
            autoClose: 5000,
            message: `${res.data.insertTaxCategory.name} was created`,
            withCloseButton: true,
          });
          return resolve(res.data.insertTaxCategory);
        });
      }),
  };
};
