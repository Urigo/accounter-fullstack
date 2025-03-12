import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  DeleteBusinessTripAttendeeDocument,
  DeleteBusinessTripAttendeeMutation,
  DeleteBusinessTripAttendeeMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteBusinessTripAttendee($fields: DeleteBusinessTripAttendeeInput!) {
    deleteBusinessTripAttendee(fields: $fields)
  }
`;

type UseDeleteBusinessTripAttendee = {
  fetching: boolean;
  deleteBusinessTripAttendee: (
    variables: DeleteBusinessTripAttendeeMutationVariables,
  ) => Promise<DeleteBusinessTripAttendeeMutation['deleteBusinessTripAttendee'] | void>;
};

const NOTIFICATION_ID = 'deleteBusinessTripAttendee';

export const useDeleteBusinessTripAttendee = (): UseDeleteBusinessTripAttendee => {
  // TODO: add authentication
  // TODO: add local data delete method after delete

  const [{ fetching }, mutate] = useMutation(DeleteBusinessTripAttendeeDocument);
  const deleteBusinessTripAttendee = useCallback(
    async (variables: DeleteBusinessTripAttendeeMutationVariables) => {
      const message = 'Error removing business trip attendee';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Removing business trip attendee', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Business trip attendee was removed',
          });
          return data.deleteBusinessTripAttendee;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    deleteBusinessTripAttendee,
  };
};
