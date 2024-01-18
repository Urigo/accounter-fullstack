import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateBusinessDocument,
  UpdateBusinessMutation,
  UpdateBusinessMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusiness($businessId: UUID!, $ownerId: UUID!, $fields: UpdateBusinessInput!) {
    updateBusiness(businessId: $businessId, ownerId: $ownerId, fields: $fields) {
      __typename
      ... on LtdFinancialEntity {
        id
        name
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type Business = Extract<
  UpdateBusinessMutation['updateBusiness'],
  { __typename: 'LtdFinancialEntity' }
>;

type UseUpdateBusiness = {
  fetching: boolean;
  updateBusiness: (variables: UpdateBusinessMutationVariables) => Promise<Business>;
};

export const useUpdateBusiness = (): UseUpdateBusiness => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateBusinessDocument);

  return {
    fetching,
    updateBusiness: (variables: UpdateBusinessMutationVariables): Promise<Business> =>
      new Promise<Business>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error updating business ID [${variables.businessId}]: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(`Error updating business ID [${variables.businessId}]: No data returned`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.updateBusiness.__typename === 'CommonError') {
            console.error(
              `Error updating business ID [${variables.businessId}]: ${res.data.updateBusiness.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.updateBusiness.message);
          }
          showNotification({
            title: 'Update Success!',
            message: 'Hey there, your update is awesome!',
          });
          return resolve(res.data.updateBusiness);
        }),
      ),
  };
};
