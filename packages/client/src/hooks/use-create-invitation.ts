import type { CombinedError } from 'urql';
import { CreateInvitationDocument, type CreateInvitationMutation } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CreateInvitation($email: String!, $roleId: String!) {
    createInvitation(email: $email, roleId: $roleId) {
      id
      email
      roleId
      expiresAt
    }
  }
`;

type UseCreateInvitation = {
  fetching: boolean;
  error: CombinedError | undefined;
  createInvitation: (input: {
    email: string;
    roleId: string;
  }) => Promise<CreateInvitationMutation['createInvitation'] | void>;
};

const NOTIFICATION_ID = 'createInvitation';

const MESSAGE = 'Error creating invitation';

export const useCreateInvitation = (): UseCreateInvitation => {
  const { fetching, error, execute } = useApiMutation({
    document: CreateInvitationDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Creating invitation',
    errorMessage: MESSAGE,
    select: data => data.createInvitation,
    successToast: { description: 'Invitation sent successfully' },
    // Surface the specific server message (e.g. "An active invitation already
    // exists for this user") so the user understands why it failed.
    errorDescription: e => (e instanceof Error ? e.message : MESSAGE),
    errorToast: { duration: 10_000 },
  });

  return {
    fetching,
    error,
    createInvitation: execute,
  };
};
