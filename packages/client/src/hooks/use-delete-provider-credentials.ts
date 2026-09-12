import {
  DeleteProviderCredentialsDocument,
  type DeleteProviderCredentialsMutation,
  type DeleteProviderCredentialsMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  const { fetching, execute } = useApiMutation({
    document: DeleteProviderCredentialsDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Disconnecting provider',
    errorMessage: 'Failed to disconnect provider',
    commonErrorPath: 'deleteProviderCredentials',
    select: data => data.deleteProviderCredentials,
    successToast: { title: 'Provider disconnected' },
  });

  return { fetching, deleteCredentials: execute };
};
