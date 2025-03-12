import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  InsertBusinessTripDocument,
  InsertBusinessTripMutation,
  InsertBusinessTripMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(InsertBusinessTripDocument);
  const insertBusinessTrip = useCallback(
    async (variables: InsertBusinessTripMutationVariables) => {
      const message = 'Error inserting business trip';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Creating trip', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Business trip created',
          });
          return data.insertBusinessTrip;
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
    insertBusinessTrip,
  };
};
