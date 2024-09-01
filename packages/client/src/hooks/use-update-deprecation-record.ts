import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateDeprecationRecordDocument,
  UpdateDeprecationRecordMutation,
  UpdateDeprecationRecordMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateDeprecationRecord($fields: UpdateDeprecationRecordInput!) {
    updateDeprecationRecord(input: $fields) {
      __typename
      ... on CommonError {
        message
      }
      ... on DeprecationRecord {
        id
      }
    }
  }
`;

type UseUpdateDeprecationRecord = {
  fetching: boolean;
  updateDeprecationRecord: (
    variables: UpdateDeprecationRecordMutationVariables,
  ) => Promise<UpdateDeprecationRecordMutation['updateDeprecationRecord']>;
};

export const useUpdateDeprecationRecord = (): UseUpdateDeprecationRecord => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(UpdateDeprecationRecordDocument);

  return {
    fetching,
    updateDeprecationRecord: (
      variables: UpdateDeprecationRecordMutationVariables,
    ): Promise<UpdateDeprecationRecordMutation['updateDeprecationRecord']> =>
      new Promise<UpdateDeprecationRecordMutation['updateDeprecationRecord']>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error updating deprecation record: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oops, deprecation record was not updated',
            });
            return reject(res.error.message);
          }
          if (res.data?.updateDeprecationRecord.__typename === 'CommonError') {
            console.error(
              `Error adding deprecation record: ${res.data.updateDeprecationRecord.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oops, deprecation record was not updated',
            });
            return reject('No data returned');
          }
          if (!res.data?.updateDeprecationRecord.id) {
            console.error('Error updating deprecation record: No data returned');
            showNotification({
              title: 'Error!',
              message: 'Oops, deprecation record was not updated',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Update Success!',
            message: 'Deprecation record was updated! 🎉',
          });
          return resolve(res.data.updateDeprecationRecord);
        }),
      ),
  };
};
