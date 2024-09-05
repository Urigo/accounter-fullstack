import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  AddDepreciationRecordDocument,
  AddDepreciationRecordMutation,
  AddDepreciationRecordMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddDepreciationRecord($fields: InsertDepreciationRecordInput!) {
    insertDepreciationRecord(input: $fields) {
      __typename
      ... on CommonError {
        message
      }
      ... on DepreciationRecord {
        id
      }
    }
  }
`;

type UseAddDepreciationRecord = {
  fetching: boolean;
  addDepreciationRecord: (
    variables: AddDepreciationRecordMutationVariables,
  ) => Promise<AddDepreciationRecordMutation['insertDepreciationRecord']>;
};

export const useAddDepreciationRecord = (): UseAddDepreciationRecord => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(AddDepreciationRecordDocument);

  return {
    fetching,
    addDepreciationRecord: (
      variables: AddDepreciationRecordMutationVariables,
    ): Promise<AddDepreciationRecordMutation['insertDepreciationRecord']> =>
      new Promise<AddDepreciationRecordMutation['insertDepreciationRecord']>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error adding depreciation record: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oops, depreciation record was not added',
            });
            return reject(res.error.message);
          }
          if (res.data?.insertDepreciationRecord.__typename === 'CommonError') {
            console.error(
              `Error adding depreciation record: ${res.data.insertDepreciationRecord.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oops, depreciation record was not added',
            });
            return reject('No data returned');
          }
          if (!res.data?.insertDepreciationRecord.id) {
            console.error('Error adding depreciation record: No data returned');
            showNotification({
              title: 'Error!',
              message: 'Oops, depreciation record was not added',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Success!',
            message: 'Depreciation record was added! 🎉',
          });
          return resolve(res.data.insertDepreciationRecord);
        }),
      ),
  };
};
