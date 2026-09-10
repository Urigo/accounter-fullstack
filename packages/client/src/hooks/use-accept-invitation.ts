import { useCallback } from 'react';
import type { CombinedError } from 'urql';
import { AcceptInvitationDocument, type AcceptInvitationMutation } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AcceptInvitation($token: String!) {
    acceptInvitation(token: $token) {
      success
      businessId
      roleId
    }
  }
`;

type UseAcceptInvitation = {
  fetching: boolean;
  error: CombinedError | undefined;
  acceptInvitation: (token: string) => Promise<AcceptInvitationMutation['acceptInvitation'] | void>;
};

const NOTIFICATION_ID = 'acceptInvitation';

export const useAcceptInvitation = (): UseAcceptInvitation => {
  const { fetching, error, execute } = useApiMutation({
    document: AcceptInvitationDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Accepting invitation',
    errorMessage: 'Error accepting invitation',
    select: data => data.acceptInvitation,
    successToast: { description: 'Invitation accepted successfully' },
    errorToast: { duration: 10_000 },
  });

  const acceptInvitation = useCallback((token: string) => execute({ token }), [execute]);

  return {
    fetching,
    error,
    acceptInvitation,
  };
};
