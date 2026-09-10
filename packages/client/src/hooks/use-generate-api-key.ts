import type { CombinedError } from 'urql';
import { GenerateApiKeyDocument, type GenerateApiKeyMutation } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation GenerateApiKey($name: String!, $roleId: String!) {
    generateApiKey(name: $name, roleId: $roleId) {
      apiKey
      record {
        id
        name
        roleId
        lastUsedAt
        createdAt
      }
    }
  }
`;

type UseGenerateApiKey = {
  fetching: boolean;
  error: CombinedError | undefined;
  generateApiKey: (input: {
    name: string;
    roleId: string;
  }) => Promise<GenerateApiKeyMutation['generateApiKey'] | void>;
};

const NOTIFICATION_ID = 'generateApiKey';

export const useGenerateApiKey = (): UseGenerateApiKey => {
  const { fetching, error, execute } = useApiMutation({
    document: GenerateApiKeyDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Generating API key',
    errorMessage: 'Error generating API key',
    select: data => data.generateApiKey,
    successToast: { description: 'API key generated successfully' },
    errorToast: { duration: 10_000 },
  });

  return {
    fetching,
    error,
    generateApiKey: execute,
  };
};
