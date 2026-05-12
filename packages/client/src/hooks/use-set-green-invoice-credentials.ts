import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  SetGreenInvoiceCredentialsDocument,
  type SetGreenInvoiceCredentialsMutation,
  type SetGreenInvoiceCredentialsMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SetGreenInvoiceCredentials($id: String!, $secret: String!) {
    setGreenInvoiceCredentials(id: $id, secret: $secret) {
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

type SetGreenInvoiceCredentialsResult =
  SetGreenInvoiceCredentialsMutation['setGreenInvoiceCredentials'];

type UseSetGreenInvoiceCredentials = {
  fetching: boolean;
  setCredentials: (
    variables: SetGreenInvoiceCredentialsMutationVariables,
  ) => Promise<SetGreenInvoiceCredentialsResult | void>;
};

const NOTIFICATION_ID = 'set-green-invoice-credentials';

export const useSetGreenInvoiceCredentials = (): UseSetGreenInvoiceCredentials => {
  const [{ fetching }, mutate] = useMutation(SetGreenInvoiceCredentialsDocument);

  const setCredentials = useCallback(
    async (variables: SetGreenInvoiceCredentialsMutationVariables) => {
      const message = 'Failed to save Green Invoice credentials';
      toast.loading('Saving Green Invoice credentials', { id: NOTIFICATION_ID });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(
          res,
          message,
          NOTIFICATION_ID,
          'setGreenInvoiceCredentials',
        );
        if (data) {
          toast.success('Green Invoice connected', { id: NOTIFICATION_ID });
          return data.setGreenInvoiceCredentials;
        }
      } catch {
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
