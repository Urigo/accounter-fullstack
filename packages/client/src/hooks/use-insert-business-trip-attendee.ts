import {
  InsertBusinessTripAttendeeDocument,
  type InsertBusinessTripAttendeeMutation,
  type InsertBusinessTripAttendeeMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: InsertBusinessTripAttendeeDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Adding attendee',
    errorMessage: 'Error adding attendee to business trip',
    select: data => data.insertBusinessTripAttendee,
    successToast: { description: 'Attendee was added to the business trip' },
  });

  return {
    fetching,
    insertBusinessTripAttendee: execute,
  };
};
