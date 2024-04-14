import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  DeleteBusinessTripAttendeeDocument,
  DeleteBusinessTripAttendeeMutation,
  DeleteBusinessTripAttendeeMutationVariables,
} from '../gql/graphql.js';

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
  ) => Promise<DeleteBusinessTripAttendeeMutation['deleteBusinessTripAttendee']>;
};

export const useDeleteBusinessTripAttendee = (): UseDeleteBusinessTripAttendee => {
  // TODO: add authentication
  // TODO: add local data delete method after delete

  const [{ fetching }, mutate] = useMutation(DeleteBusinessTripAttendeeDocument);

  return {
    fetching,
    deleteBusinessTripAttendee: (
      variables: DeleteBusinessTripAttendeeMutationVariables,
    ): Promise<DeleteBusinessTripAttendeeMutation['deleteBusinessTripAttendee']> =>
      new Promise<DeleteBusinessTripAttendeeMutation['deleteBusinessTripAttendee']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error removing business trip attendee: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, attendee was not removed',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error removing business trip attendee: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, attendee was not removed',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Removal Success!',
              message: 'Business trip attendee was removed! 🎉',
            });
            return resolve(res.data.deleteBusinessTripAttendee);
          }),
      ),
  };
};
