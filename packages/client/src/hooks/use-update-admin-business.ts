import {
  UpdateAdminBusinessDocument,
  type UpdateAdminBusinessMutation,
  type UpdateAdminBusinessMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateAdminBusiness($adminBusinessId: UUID!, $fields: UpdateAdminBusinessInput!) {
    updateAdminBusiness(businessId: $adminBusinessId, fields: $fields) {
      id
    }
  }
`;

type AdminBusiness = UpdateAdminBusinessMutation['updateAdminBusiness'];

type UseUpdateBusiness = {
  fetching: boolean;
  updateAdminBusiness: (
    variables: UpdateAdminBusinessMutationVariables,
  ) => Promise<AdminBusiness | void>;
};

const NOTIFICATION_ID = 'updateAdminBusiness';

export const useUpdateAdminBusiness = (): UseUpdateBusiness => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: UpdateAdminBusinessDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.adminBusinessId}`,
    loadingMessage: 'Updating admin business',
    errorMessage: variables => `Error updating admin business ID [${variables.adminBusinessId}]`,
    commonErrorPath: 'updateAdminBusiness',
    select: data => data.updateAdminBusiness,
    successToast: { description: 'Admin Business Updated' },
  });

  return {
    fetching,
    updateAdminBusiness: execute,
  };
};
