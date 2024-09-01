import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  AddDeprecationRecordDocument,
  AddDeprecationRecordMutation,
  AddDeprecationRecordMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddDeprecationRecord($fields: InsertDeprecationRecordInput!) {
    insertDeprecationRecord(input: $fields) {
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

type UseAddDeprecationRecord = {
  fetching: boolean;
  addDeprecationRecord: (
    variables: AddDeprecationRecordMutationVariables,
  ) => Promise<AddDeprecationRecordMutation['insertDeprecationRecord']>;
};

export const useAddDeprecationRecord = (): UseAddDeprecationRecord => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(AddDeprecationRecordDocument);

  return {
    fetching,
    addDeprecationRecord: (
      variables: AddDeprecationRecordMutationVariables,
    ): Promise<AddDeprecationRecordMutation['insertDeprecationRecord']> =>
      new Promise<AddDeprecationRecordMutation['insertDeprecationRecord']>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error adding deprecation record: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oops, deprecation record was not added',
            });
            return reject(res.error.message);
          }
          if (res.data?.insertDeprecationRecord.__typename === 'CommonError') {
            console.error(
              `Error adding deprecation record: ${res.data.insertDeprecationRecord.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oops, deprecation record was not added',
            });
            return reject('No data returned');
          }
          if (!res.data?.insertDeprecationRecord.id) {
            console.error('Error adding deprecation record: No data returned');
            showNotification({
              title: 'Error!',
              message: 'Oops, deprecation record was not added',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Success!',
            message: 'Deprecation record was added! 🎉',
          });
          return resolve(res.data.insertDeprecationRecord);
        }),
      ),
  };
};
