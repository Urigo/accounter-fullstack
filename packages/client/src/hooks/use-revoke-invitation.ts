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

export const useRevokeInvitation = (): UseRevokeInvitation => {
  const { fetching, error, execute } = useApiMutation({
    document: RevokeInvitationDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Revoking invitation',
    errorMessage: 'Error revoking invitation',
    select: data => data.revokeInvitation,
    // A `false` is not a failure to report through the error path: the mutation resolved, and
    // callers refetch on it so the stale row is dropped. It only needs its own notification.
    successToast: revoked =>
      revoked
        ? { description: 'Invitation revoked successfully' }
        : {
            variant: 'error',
            title: 'Error',
            description: 'Failed to revoke invitation. It may have already been revoked.',
          },
    errorToast: { duration: 10_000 },
  });

  const revokeInvitation = useCallback((id: string) => execute({ id }), [execute]);

  return {
    fetching,
    error,
    revokeInvitation,
  };
};
