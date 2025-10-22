import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateAdminBusinessDocument,
  type UpdateAdminBusinessMutation,
  type UpdateAdminBusinessMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(UpdateAdminBusinessDocument);
  const updateAdminBusiness = useCallback(
    async (variables: UpdateAdminBusinessMutationVariables) => {
      const message = `Error updating admin business ID [${variables.adminBusinessId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.adminBusinessId}`;
      toast.loading('Updating admin business', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateAdminBusiness');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Admin Business Updated',
          });
          return data.updateAdminBusiness;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    updateAdminBusiness,
  };
};
