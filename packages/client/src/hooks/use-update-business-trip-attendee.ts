import {
  UpdateBusinessTripAttendeeDocument,
  type UpdateBusinessTripAttendeeMutation,
  type UpdateBusinessTripAttendeeMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: UpdateBusinessTripAttendeeDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Updating trip attendee',
    errorMessage: 'Error updating business trip attendee',
    select: data => data.updateBusinessTripAttendee,
    successToast: { description: 'Business trip attendee was updated' },
  });

  return {
    fetching,
    updateBusinessTripAttendee: execute,
  };
};
