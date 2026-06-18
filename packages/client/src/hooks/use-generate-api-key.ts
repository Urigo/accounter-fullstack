import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation, type CombinedError } from 'urql';
import { GenerateApiKeyDocument, type GenerateApiKeyMutation } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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
  const [{ fetching, error }, mutate] = useMutation(GenerateApiKeyDocument);
  const generateApiKey = useCallback(
    async ({ name, roleId }: { name: string; roleId: string }) => {
      const message = 'Error generating API key';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Generating API key', {
        id: notificationId,
      });
      try {
        const result = await mutate({ name, roleId });
        const data = handleCommonErrors(result, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'API key generated successfully',
          });
          return data.generateApiKey;
        }
      } catch (e) {
        console.error(message, e);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 10_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    error,
    generateApiKey,
  };
};
