import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateBusinessTripAttendeeDocument,
  type UpdateBusinessTripAttendeeMutation,
  type UpdateBusinessTripAttendeeMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripAttendee($fields: BusinessTripAttendeeUpdateInput!) {
    updateBusinessTripAttendee(fields: $fields)
  }
`;

type UseUpdateBusinessTripAttendee = {
  fetching: boolean;
  updateBusinessTripAttendee: (
    variables: UpdateBusinessTripAttendeeMutationVariables,
  ) => Promise<UpdateBusinessTripAttendeeMutation['updateBusinessTripAttendee'] | void>;
};

const NOTIFICATION_ID = 'updateBusinessTripAttendee';

export const useUpdateBusinessTripAttendee = (): UseUpdateBusinessTripAttendee => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(UpdateBusinessTripAttendeeDocument);
  const updateBusinessTripAttendee = useCallback(
    async (variables: UpdateBusinessTripAttendeeMutationVariables) => {
      const message = 'Error updating business trip attendee';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Updating trip attendee', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Business trip attendee was updated',
          });
          return data.updateBusinessTripAttendee;
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
    updateBusinessTripAttendee,
  };
};
