import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateBusinessTripAttendeeDocument,
  UpdateBusinessTripAttendeeMutation,
  UpdateBusinessTripAttendeeMutationVariables,
} from '../gql/graphql.js';

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
  ) => Promise<UpdateBusinessTripAttendeeMutation['updateBusinessTripAttendee']>;
};

export const useUpdateBusinessTripAttendee = (): UseUpdateBusinessTripAttendee => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(UpdateBusinessTripAttendeeDocument);

  return {
    fetching,
    updateBusinessTripAttendee: (
      variables: UpdateBusinessTripAttendeeMutationVariables,
    ): Promise<UpdateBusinessTripAttendeeMutation['updateBusinessTripAttendee']> =>
      new Promise<UpdateBusinessTripAttendeeMutation['updateBusinessTripAttendee']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error updating business trip attendee: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, attendee was not updated',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error updating business trip attendee: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, attendee was not updated',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Update Success!',
              message: 'Business trip attendee was updated! 🎉',
            });
            return resolve(res.data.updateBusinessTripAttendee);
          }),
      ),
  };
};
