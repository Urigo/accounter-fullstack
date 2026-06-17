import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation, type CombinedError } from 'urql';
import { RevokeApiKeyDocument, type RevokeApiKeyMutation } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation RevokeApiKey($id: ID!) {
    revokeApiKey(id: $id)
  }
`;

type UseRevokeApiKey = {
  fetching: boolean;
  error: CombinedError | undefined;
  revokeApiKey: (id: string) => Promise<RevokeApiKeyMutation['revokeApiKey'] | void>;
};

const NOTIFICATION_ID = 'revokeApiKey';

export const useRevokeApiKey = (): UseRevokeApiKey => {
  const [{ fetching, error }, mutate] = useMutation(RevokeApiKeyDocument);
  const revokeApiKey = useCallback(
    async (id: string) => {
      const message = 'Error revoking API key';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Revoking API key', {
        id: notificationId,
      });
      try {
        const result = await mutate({ id });
        const data = handleCommonErrors(result, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'API key revoked successfully',
          });
          return data.revokeApiKey;
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
    revokeApiKey,
  };
};
