import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  DeleteProviderCredentialsDocument,
  type DeleteProviderCredentialsMutation,
  type DeleteProviderCredentialsMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteProviderCredentials($provider: ProviderKey!) {
    deleteProviderCredentials(provider: $provider) {
      ... on ProviderCredentialDeleteResult {
        id
        provider
        success
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type DeleteProviderCredentialsResult =
  DeleteProviderCredentialsMutation['deleteProviderCredentials'];

type UseDeleteProviderCredentials = {
  fetching: boolean;
  deleteCredentials: (
    variables: DeleteProviderCredentialsMutationVariables,
  ) => Promise<DeleteProviderCredentialsResult | void>;
};

const NOTIFICATION_ID = 'delete-provider-credentials';

export const useDeleteProviderCredentials = (): UseDeleteProviderCredentials => {
  const [{ fetching }, mutate] = useMutation(DeleteProviderCredentialsDocument);

  const deleteCredentials = useCallback(
    async (variables: DeleteProviderCredentialsMutationVariables) => {
      const message = 'Failed to disconnect provider';
      toast.loading('Disconnecting provider', { id: NOTIFICATION_ID });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, NOTIFICATION_ID, 'deleteProviderCredentials');
        if (data) {
          toast.success('Provider disconnected', { id: NOTIFICATION_ID });
          return data.deleteProviderCredentials;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: NOTIFICATION_ID,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return { fetching, deleteCredentials };
};
