import {
  SetGreenInvoiceCredentialsDocument,
  type SetGreenInvoiceCredentialsMutation,
  type SetGreenInvoiceCredentialsMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  const { fetching, execute } = useApiMutation({
    document: SetGreenInvoiceCredentialsDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Saving Green Invoice credentials',
    errorMessage: 'Failed to save Green Invoice credentials',
    commonErrorPath: 'setGreenInvoiceCredentials',
    select: data => data.setGreenInvoiceCredentials,
    successToast: { title: 'Green Invoice connected' },
  });

  return { fetching, setCredentials: execute };
};
