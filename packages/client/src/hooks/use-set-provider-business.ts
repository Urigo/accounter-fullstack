import {
  SetProviderBusinessDocument,
  type SetProviderBusinessMutation,
  type SetProviderBusinessMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SetProviderBusiness($provider: ProviderKey!, $businessId: UUID!) {
    setProviderBusiness(provider: $provider, businessId: $businessId) {
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

type SetProviderBusinessResult = SetProviderBusinessMutation['setProviderBusiness'];

type UseSetProviderBusiness = {
  fetching: boolean;
  setProviderBusiness: (
    variables: SetProviderBusinessMutationVariables,
  ) => Promise<SetProviderBusinessResult | void>;
};

const NOTIFICATION_ID = 'set-provider-business';

export const useSetProviderBusiness = (): UseSetProviderBusiness => {
  const { fetching, execute } = useApiMutation({
    document: SetProviderBusinessDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Saving provider business',
    errorMessage: 'Failed to save provider business',
    commonErrorPath: 'setProviderBusiness',
    select: data => data.setProviderBusiness,
    successToast: { title: 'Provider business saved' },
  });

  return { fetching, setProviderBusiness: execute };
};
