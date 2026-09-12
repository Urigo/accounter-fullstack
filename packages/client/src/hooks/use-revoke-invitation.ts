import { useCallback } from 'react';
import type { CombinedError } from 'urql';
import { RevokeInvitationDocument, type RevokeInvitationMutation } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation RevokeInvitation($id: ID!) {
    revokeInvitation(id: $id)
  }
`;

type UseRevokeInvitation = {
  fetching: boolean;
  error: CombinedError | undefined;
  revokeInvitation: (id: string) => Promise<RevokeInvitationMutation['revokeInvitation'] | void>;
};

const NOTIFICATION_ID = 'revokeInvitation';

const MESSAGE = 'Error revoking invitation';

export const useRevokeInvitation = (): UseRevokeInvitation => {
  const { fetching, error, execute } = useApiMutation({
    document: RevokeInvitationDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Revoking invitation',
    errorMessage: MESSAGE,
    select: data => {
      if (!data.revokeInvitation) {
        // No GraphQL error, but nothing was revoked (already revoked or not found).
        throw new Error('Failed to revoke invitation. It may have already been revoked.');
      }
      return true as const;
    },
    successToast: { description: 'Invitation revoked successfully' },
    errorDescription: e => (e instanceof Error ? e.message : MESSAGE),
    errorToast: { duration: 10_000 },
  });

  const revokeInvitation = useCallback((id: string) => execute({ id }), [execute]);

  return {
    fetching,
    error,
    revokeInvitation,
  };
};
