import {
  UpdateBusinessDocument,
  type UpdateBusinessMutation,
  type UpdateBusinessMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  updateBusiness: (variables: UpdateBusinessMutationVariables) => Promise<Business | void>;
};

const NOTIFICATION_ID = 'updateBusiness';

export const useUpdateBusiness = (): UseUpdateBusiness => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: UpdateBusinessDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.businessId}`,
    loadingMessage: 'Updating business',
    errorMessage: variables => `Error updating business ID [${variables.businessId}]`,
    commonErrorPath: 'updateBusiness',
    select: data => data.updateBusiness,
    successToast: { description: 'Business updated' },
  });

  return {
    fetching,
    updateBusiness: execute,
  };
};
