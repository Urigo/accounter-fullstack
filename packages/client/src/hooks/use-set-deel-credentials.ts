import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  SetDeelCredentialsDocument,
  type SetDeelCredentialsMutation,
  type SetDeelCredentialsMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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
  const [{ fetching }, mutate] = useMutation(SetDeelCredentialsDocument);

  const setCredentials = useCallback(
    async (variables: SetDeelCredentialsMutationVariables) => {
      const message = 'Failed to save Deel credentials';
      toast.loading('Saving Deel credentials', { id: NOTIFICATION_ID });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, NOTIFICATION_ID, 'setDeelCredentials');
        if (data) {
          toast.success('Deel connected', { id: NOTIFICATION_ID });
          return data.setDeelCredentials;
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

  return { fetching, setCredentials };
};
