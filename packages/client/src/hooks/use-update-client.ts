import {
  UpdateClientDocument,
  type UpdateClientMutation,
  type UpdateClientMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateClient($businessId: UUID!, $fields: ClientUpdateInput!) {
    updateClient(businessId: $businessId, fields: $fields) {
      __typename
      ... on Client {
        id
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type Client = Extract<UpdateClientMutation['updateClient'], { __typename: 'Client' }>;

type UseUpdateClient = {
  fetching: boolean;
  updateClient: (variables: UpdateClientMutationVariables) => Promise<Client | void>;
};

const NOTIFICATION_ID = 'updateClient';

export const useUpdateClient = (): UseUpdateClient => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: UpdateClientDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.businessId}`,
    loadingMessage: 'Updating client',
    errorMessage: variables => `Error updating client ID [${variables.businessId}]`,
    commonErrorPath: 'updateClient',
    select: data => data.updateClient,
    successToast: { description: 'Client updated' },
  });

  return {
    fetching,
    updateClient: execute,
  };
};
