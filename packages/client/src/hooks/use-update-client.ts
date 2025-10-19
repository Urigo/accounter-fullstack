import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateClientDocument,
  type UpdateClientMutation,
  type UpdateClientMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(UpdateClientDocument);
  const updateClient = useCallback(
    async (variables: UpdateClientMutationVariables) => {
      const message = `Error updating client ID [${variables.businessId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.businessId}`;
      toast.loading('Updating client', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateClient');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Client updated',
          });
          return data.updateClient;
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
    updateClient,
  };
};
