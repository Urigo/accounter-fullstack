import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  DeleteDepreciationRecordDocument,
  DeleteDepreciationRecordMutation,
  DeleteDepreciationRecordMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteDepreciationRecord($depreciationRecordId: UUID!) {
    deleteDepreciationRecord(depreciationRecordId: $depreciationRecordId)
  }
`;

type UseDeleteDepreciationRecord = {
  fetching: boolean;
  deleteDepreciationRecord: (
    variables: DeleteDepreciationRecordMutationVariables,
  ) => Promise<DeleteDepreciationRecordMutation['deleteDepreciationRecord']>;
};

export const useDeleteDepreciationRecord = (): UseDeleteDepreciationRecord => {
  // TODO: add authentication
  // TODO: add local data delete method after delete

  const [{ fetching }, mutate] = useMutation(DeleteDepreciationRecordDocument);

  return {
    fetching,
    deleteDepreciationRecord: (
      variables: DeleteDepreciationRecordMutationVariables,
    ): Promise<DeleteDepreciationRecordMutation['deleteDepreciationRecord']> =>
      new Promise<DeleteDepreciationRecordMutation['deleteDepreciationRecord']>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error deleting depreciation record: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oops, depreciation record was not deleted',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error('Error deleting depreciation record: No data returned');
            showNotification({
              title: 'Error!',
              message: 'Oops, depreciation record was not deleted',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Removal Success!',
            message: 'Depreciation record was deleted! 🎉',
          });
          return resolve(res.data.deleteDepreciationRecord);
        }),
      ),
  };
};
