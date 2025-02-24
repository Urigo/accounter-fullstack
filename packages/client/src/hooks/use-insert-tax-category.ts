import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
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

export const useInsertTaxCategory = (): UseInsertTaxCategory => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertTaxCategoryDocument);

  return {
    fetching,
    insertTaxCategory: (
      variables: InsertTaxCategoryMutationVariables,
    ): Promise<InsertTaxCategorySuccessfulResult> =>
      new Promise<InsertTaxCategorySuccessfulResult>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error creating business [${variables.fields.name}]: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(`Error creating business [${variables.fields.name}]: No data returned`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Insert Success!',
            message: 'Your document was added! 🎉',
          });
          return resolve(res.data.insertTaxCategory);
        }),
      ),
  };
};
