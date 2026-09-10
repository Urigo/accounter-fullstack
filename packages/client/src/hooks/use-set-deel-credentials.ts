import {
  SetDeelCredentialsDocument,
  type SetDeelCredentialsMutation,
  type SetDeelCredentialsMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SetDeelCredentials($apiToken: String!) {
    setDeelCredentials(apiToken: $apiToken) {
      ... on ProviderCredentialResult {
        id
        provider
        configuredAt
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type SetDeelCredentialsResult = SetDeelCredentialsMutation['setDeelCredentials'];

type UseSetDeelCredentials = {
  fetching: boolean;
  setCredentials: (
    variables: SetDeelCredentialsMutationVariables,
  ) => Promise<SetDeelCredentialsResult | void>;
};

const NOTIFICATION_ID = 'set-deel-credentials';

export const useSetDeelCredentials = (): UseSetDeelCredentials => {
  const { fetching, execute } = useApiMutation({
    document: SetDeelCredentialsDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Saving Deel credentials',
    errorMessage: 'Failed to save Deel credentials',
    commonErrorPath: 'setDeelCredentials',
    select: data => data.setDeelCredentials,
    successToast: { title: 'Deel connected' },
  });

  return { fetching, setCredentials: execute };
};
