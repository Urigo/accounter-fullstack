import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  InsertBusinessTripAttendeeDocument,
  InsertBusinessTripAttendeeMutation,
  InsertBusinessTripAttendeeMutationVariables,
} from '../gql/graphql.js';

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
  ) => Promise<InsertBusinessTripAttendeeMutation['insertBusinessTripAttendee']>;
};

export const useInsertBusinessTripAttendee = (): UseInsertBusinessTripAttendee => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertBusinessTripAttendeeDocument);

  return {
    fetching,
    insertBusinessTripAttendee: (
      variables: InsertBusinessTripAttendeeMutationVariables,
    ): Promise<InsertBusinessTripAttendeeMutation['insertBusinessTripAttendee']> =>
      new Promise<InsertBusinessTripAttendeeMutation['insertBusinessTripAttendee']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error adding attendee to business trip: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, attendee was not added',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error adding attendee to business trip: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, attendee was not added',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Insert Success!',
              message: 'Attendee was added to the business trip! 🎉',
            });
            return resolve(res.data.insertBusinessTripAttendee);
          }),
      ),
  };
};
