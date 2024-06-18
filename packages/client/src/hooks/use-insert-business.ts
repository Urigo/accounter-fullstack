import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  InsertBusinessDocument,
  InsertBusinessMutation,
  InsertBusinessMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertBusiness($fields: InsertNewBusinessInput!) {
    insertNewBusiness(fields: $fields) {
      __typename
      ... on LtdFinancialEntity {
        id
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type InsertBusinessSuccessfulResult = Extract<
  InsertBusinessMutation['insertNewBusiness'],
  { __typename: 'LtdFinancialEntity' }
>;

type UseInsertBusiness = {
  fetching: boolean;
  insertBusiness: (
    variables: InsertBusinessMutationVariables,
  ) => Promise<InsertBusinessSuccessfulResult>;
};

export const useInsertBusiness = (): UseInsertBusiness => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertBusinessDocument);

  return {
    fetching,
    insertBusiness: (
      variables: InsertBusinessMutationVariables,
    ): Promise<InsertBusinessSuccessfulResult> =>
      new Promise<InsertBusinessSuccessfulResult>((resolve, reject) =>
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
          if (res.data.insertNewBusiness.__typename === 'CommonError') {
            console.error(
              `Error creating business [${variables.fields.name}]: ${res.data.insertNewBusiness.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.insertNewBusiness.message);
          }
          showNotification({
            title: 'Insert Success!',
            message: 'Your document was added! 🎉',
          });
          return resolve(res.data.insertNewBusiness);
        }),
      ),
  };
};
