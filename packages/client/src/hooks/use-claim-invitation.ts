import { useCallback } from 'react';
import type { CombinedError } from 'urql';
import { ClaimInvitationDocument, type ClaimInvitationMutation } from '../gql/graphql.js';
import { MUTATION_DEDUPE_WINDOW_MS } from '../helpers/mutation-dedupe.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation ClaimInvitation($invitationId: UUID!) {
    claimInvitation(invitationId: $invitationId) {
      success
      businessId
      roleId
    }
  }
`;

type UseClaimInvitation = {
  fetching: boolean;
  error: CombinedError | undefined;
  claimInvitation: (
    invitationId: string,
  ) => Promise<ClaimInvitationMutation['claimInvitation'] | void>;
};

const NOTIFICATION_ID = 'claimInvitation';

export const useClaimInvitation = (): UseClaimInvitation => {
  const { fetching, error, execute } = useApiMutation({
    document: ClaimInvitationDocument,
    // Claiming links a membership and unblocks (or deletes) an Auth0 placeholder
    // user, so a double-click is worth stopping. Unlike `acceptInvitation`, whose
    // repeat reports TOKEN_ALREADY_USED, a second claim finds the invitation
    // already accepted and answers with the deliberately vague "not available for
    // your account" — alarming wording for someone who just succeeded.
    dedupe: { windowMs: MUTATION_DEDUPE_WINDOW_MS },
    notificationId: variables => `${NOTIFICATION_ID}-${variables.invitationId}`,
    loadingMessage: 'Joining business',
    errorMessage: 'Error joining business',
    select: data => data.claimInvitation,
    successToast: { description: 'Invitation accepted successfully' },
    errorToast: { duration: 10_000 },
  });

  const claimInvitation = useCallback(
    (invitationId: string) => execute({ invitationId }),
    [execute],
  );

  return { fetching, error, claimInvitation };
};
