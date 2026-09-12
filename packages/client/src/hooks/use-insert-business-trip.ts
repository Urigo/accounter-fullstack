import {
  InsertBusinessTripDocument,
  type InsertBusinessTripMutation,
  type InsertBusinessTripMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertBusinessTrip($fields: InsertBusinessTripInput!) {
    insertBusinessTrip(fields: $fields)
  }
`;

type UseInsertBusinessTrip = {
  fetching: boolean;
  insertBusinessTrip: (
    variables: InsertBusinessTripMutationVariables,
  ) => Promise<InsertBusinessTripMutation['insertBusinessTrip'] | void>;
};

const NOTIFICATION_ID = 'insertBusinessTrip';

export const useInsertBusinessTrip = (): UseInsertBusinessTrip => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const { fetching, execute } = useApiMutation({
    document: InsertBusinessTripDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Creating trip',
    errorMessage: 'Error inserting business trip',
    select: data => data.insertBusinessTrip,
    successToast: { description: 'Business trip created' },
  });

  return {
    fetching,
    insertBusinessTrip: execute,
  };
};
