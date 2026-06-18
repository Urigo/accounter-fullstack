import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation, type CombinedError } from 'urql';
import { CreateInvitationDocument, type CreateInvitationMutation } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

export const useCreateInvitation = (): UseCreateInvitation => {
  const [{ fetching, error }, mutate] = useMutation(CreateInvitationDocument);
  const createInvitation = useCallback(
    async ({ email, roleId }: { email: string; roleId: string }) => {
      const message = 'Error creating invitation';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Creating invitation', {
        id: notificationId,
      });
      try {
        const result = await mutate({ email, roleId });
        const data = handleCommonErrors(result, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Invitation sent successfully',
          });
          return data.createInvitation;
        }
      } catch (e) {
        console.error(message, e);
        // Surface the specific server message (e.g. "An active invitation already
        // exists for this user") so the user understands why it failed.
        toast.error('Error', {
          id: notificationId,
          description: e instanceof Error ? e.message : message,
          duration: 10_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    error,
    createInvitation,
  };
};
