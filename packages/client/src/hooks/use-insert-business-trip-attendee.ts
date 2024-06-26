import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { graphql, ResultOf, VariablesOf } from '../graphql.js';

export const InsertBusinessTripAttendeeDocument = graphql(`
  mutation InsertBusinessTripAttendee($fields: InsertBusinessTripAttendeeInput!) {
    insertBusinessTripAttendee(fields: $fields)
  }
`);

type InsertBusinessTripAttendeeMutationVariables = VariablesOf<
  typeof InsertBusinessTripAttendeeDocument
>;
type InsertBusinessTripAttendeeMutation = ResultOf<typeof InsertBusinessTripAttendeeDocument>;

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
