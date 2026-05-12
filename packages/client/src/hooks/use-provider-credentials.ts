import { useQuery } from 'urql';
import { ProviderCredentialsDocument, type ProviderCredentialsQuery } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ProviderCredentials {
    providerCredentials {
      id
      provider
      configuredAt
    }
  }
`;

type ProviderCredentialStatus = ProviderCredentialsQuery['providerCredentials'][number];

type UseProviderCredentials = {
  data: ProviderCredentialStatus[] | undefined;
  fetching: boolean;
  error: Error | undefined;
  refetch: () => void;
};

export const useProviderCredentials = (): UseProviderCredentials => {
  const [{ data, fetching, error }, reexecute] = useQuery({
    query: ProviderCredentialsDocument,
  });

  return {
    data: data?.providerCredentials,
    fetching,
    error,
    refetch: () => reexecute({ requestPolicy: 'network-only' }),
  };
};
