import type { CombinedError } from 'urql';
import {
  BootstrapNewClientDocument,
  type BootstrapClientInput,
  type BootstrapNewClientMutation,
} from '../gql/graphql.js';
import { MUTATION_DEDUPE_WINDOW_MS } from '../helpers/mutation-dedupe.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation BootstrapNewClient($input: BootstrapClientInput!) {
    bootstrapNewClient(input: $input) {
      id
      invitationToken
      business {
        id
        name
      }
    }
  }
`;

type UseBootstrapNewClient = {
  fetching: boolean;
  error: CombinedError | undefined;
  bootstrapNewClient: (input: {
    input: BootstrapClientInput;
  }) => Promise<BootstrapNewClientMutation['bootstrapNewClient'] | void>;
};

const NOTIFICATION_ID = 'bootstrapNewClient';

const MESSAGE = 'Error creating tenant';

/** Creates a client tenant and its owner's invitation. Super-admin only (checked by the server). */
export const useBootstrapNewClient = (): UseBootstrapNewClient => {
  const { fetching, error, execute } = useApiMutation({
    document: BootstrapNewClientDocument,
    // Creates a tenant and an Auth0 user: an accidental double submit must not run it twice.
    dedupe: { windowMs: MUTATION_DEDUPE_WINDOW_MS },
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Creating tenant',
    errorMessage: MESSAGE,
    select: data => data.bootstrapNewClient,
    successToast: { description: 'Tenant created' },
    errorDescription: e => (e instanceof Error ? e.message : MESSAGE),
    errorToast: { duration: 10_000 },
  });

  return {
    fetching,
    error,
    bootstrapNewClient: execute,
  };
};
