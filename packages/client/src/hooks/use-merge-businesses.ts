import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import { MergeBusinessesDocument, MergeBusinessesMutationVariables } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation MergeBusinesses($targetBusinessId: UUID!, $businessIdsToMerge: [UUID!]!) {
    mergeBusinesses(targetBusinessId: $targetBusinessId, businessIdsToMerge: $businessIdsToMerge) {
      __typename
      id
    }
  }
`;

type UseMergeBusinesses = {
  fetching: boolean;
  mergeBusinesses: (variables: MergeBusinessesMutationVariables) => Promise<string>;
};

const NOTIFICATION_ID = 'mergeBusinesses';

export const useMergeBusinesses = (): UseMergeBusinesses => {
  // TODO: add authentication
  // TODO: add local data update method after chang e

  const [{ fetching }, mutate] = useMutation(MergeBusinessesDocument);

  return {
    fetching,
    mergeBusinesses: (variables: MergeBusinessesMutationVariables): Promise<string> => {
      notifications.show({
        id: NOTIFICATION_ID,
        loading: true,
        title: 'Merging Businesses',
        message: 'Please wait...',
        autoClose: false,
        withCloseButton: true,
      });
      return new Promise<string>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error merging into business ID [${variables.targetBusinessId}]: ${res.error}`,
            );
            notifications.update({
              id: NOTIFICATION_ID,
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
              color: 'red',
              autoClose: 5000,
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error merging into business ID [${variables.targetBusinessId}]: No data returned`,
            );
            notifications.update({
              id: NOTIFICATION_ID,
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
              color: 'red',
              autoClose: 5000,
            });
            return reject('No data returned');
          }
          notifications.update({
            id: NOTIFICATION_ID,
            title: 'Merge Success!',
            autoClose: 5000,
            message: undefined,
            withCloseButton: true,
          });
          return resolve(res.data.mergeBusinesses.id);
        }),
      );
    },
  };
};
