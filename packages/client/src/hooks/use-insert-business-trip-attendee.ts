import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  InsertBusinessTripAttendeeDocument,
  type InsertBusinessTripAttendeeMutation,
  type InsertBusinessTripAttendeeMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertBusinessTripAttendee($fields: InsertBusinessTripAttendeeInput!) {
    insertBusinessTripAttendee(fields: $fields)
  }
`;

type UseInsertBusinessTripAttendee = {
  fetching: boolean;
  insertBusinessTripAttendee: (
    variables: InsertBusinessTripAttendeeMutationVariables,
  ) => Promise<InsertBusinessTripAttendeeMutation['insertBusinessTripAttendee'] | void>;
};

const NOTIFICATION_ID = 'insertBusinessTripAttendee';

export const useInsertBusinessTripAttendee = (): UseInsertBusinessTripAttendee => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertBusinessTripAttendeeDocument);
  const insertBusinessTripAttendee = useCallback(
    async (variables: InsertBusinessTripAttendeeMutationVariables) => {
      const message = 'Error adding attendee to business trip';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Adding attendee', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Attendee was added to the business trip',
          });
          return data.insertBusinessTripAttendee;
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
    insertBusinessTripAttendee,
  };
};
