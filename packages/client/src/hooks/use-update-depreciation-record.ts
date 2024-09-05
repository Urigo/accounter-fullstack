import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  UpdateDepreciationRecordDocument,
  UpdateDepreciationRecordMutation,
  UpdateDepreciationRecordMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateDepreciationRecord($fields: UpdateDepreciationRecordInput!) {
    updateDepreciationRecord(input: $fields) {
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

type UseUpdateDepreciationRecord = {
  fetching: boolean;
  updateDepreciationRecord: (
    variables: UpdateDepreciationRecordMutationVariables,
  ) => Promise<UpdateDepreciationRecordMutation['updateDepreciationRecord']>;
};

export const useUpdateDepreciationRecord = (): UseUpdateDepreciationRecord => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(UpdateDepreciationRecordDocument);

  return {
    fetching,
    updateDepreciationRecord: (
      variables: UpdateDepreciationRecordMutationVariables,
    ): Promise<UpdateDepreciationRecordMutation['updateDepreciationRecord']> =>
      new Promise<UpdateDepreciationRecordMutation['updateDepreciationRecord']>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error updating depreciation record: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oops, depreciation record was not updated',
            });
            return reject(res.error.message);
          }
          if (res.data?.updateDepreciationRecord.__typename === 'CommonError') {
            console.error(
              `Error adding depreciation record: ${res.data.updateDepreciationRecord.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oops, depreciation record was not updated',
            });
            return reject('No data returned');
          }
          if (!res.data?.updateDepreciationRecord.id) {
            console.error('Error updating depreciation record: No data returned');
            showNotification({
              title: 'Error!',
              message: 'Oops, depreciation record was not updated',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Update Success!',
            message: 'Depreciation record was updated! 🎉',
          });
          return resolve(res.data.updateDepreciationRecord);
        }),
      ),
  };
};
