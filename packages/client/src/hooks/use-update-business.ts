import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateBusinessDocument,
  type UpdateBusinessMutation,
  type UpdateBusinessMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(UpdateBusinessDocument);
  const updateBusiness = useCallback(
    async (variables: UpdateBusinessMutationVariables) => {
      const message = `Error updating business ID [${variables.businessId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.businessId}`;
      toast.loading('Updating business', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateBusiness');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Business updated',
          });
          return data.updateBusiness;
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
    updateBusiness,
  };
};
