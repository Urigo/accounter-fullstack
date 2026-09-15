import {
  DeleteBusinessTripAttendeeDocument,
  type DeleteBusinessTripAttendeeMutation,
  type DeleteBusinessTripAttendeeMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: DeleteBusinessTripAttendeeDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Removing business trip attendee',
    errorMessage: 'Error removing business trip attendee',
    select: data => data.deleteBusinessTripAttendee,
    successToast: { description: 'Business trip attendee was removed' },
  });

  return {
    fetching,
    deleteBusinessTripAttendee: execute,
  };
};
