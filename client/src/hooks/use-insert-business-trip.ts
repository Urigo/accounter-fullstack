import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  BusinessTrip,
  InsertBusinessTripDocument,
  InsertBusinessTripMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertBusinessTrip($fields: InsertBusinessTripInput!) {
    insertBusinessTrip(fields: $fields) {
      id
      name
    }
  }
`;

type UseInsertBusinessTrip = {
  fetching: boolean;
  insertBusinessTrip: (variables: InsertBusinessTripMutationVariables) => Promise<BusinessTrip>;
};

export const useInsertBusinessTrip = (): UseInsertBusinessTrip => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertBusinessTripDocument);

  return {
    fetching,
    insertBusinessTrip: (variables: InsertBusinessTripMutationVariables): Promise<BusinessTrip> =>
      new Promise<BusinessTrip>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error inserting business trip: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error('Error inserting business trip: No data returned');
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Insert Success!',
            message: 'Your business trip was added! 🎉',
          });
          return resolve(res.data.insertBusinessTrip);
        }),
      ),
  };
};
