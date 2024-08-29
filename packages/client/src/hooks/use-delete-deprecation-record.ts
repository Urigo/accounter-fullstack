import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  DeleteDeprecationRecordDocument,
  DeleteDeprecationRecordMutation,
  DeleteDeprecationRecordMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteDeprecationRecord($deprecationRecordId: UUID!) {
    deleteDeprecationRecord(deprecationRecordId: $deprecationRecordId)
  }
`;

type UseDeleteDeprecationRecord = {
  fetching: boolean;
  deleteDeprecationRecord: (
    variables: DeleteDeprecationRecordMutationVariables,
  ) => Promise<DeleteDeprecationRecordMutation['deleteDeprecationRecord']>;
};

export const useDeleteDeprecationRecord = (): UseDeleteDeprecationRecord => {
  // TODO: add authentication
  // TODO: add local data delete method after delete

  const [{ fetching }, mutate] = useMutation(DeleteDeprecationRecordDocument);

  return {
    fetching,
    deleteDeprecationRecord: (
      variables: DeleteDeprecationRecordMutationVariables,
    ): Promise<DeleteDeprecationRecordMutation['deleteDeprecationRecord']> =>
      new Promise<DeleteDeprecationRecordMutation['deleteDeprecationRecord']>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(`Error deleting deprecation record: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oops, deprecation record was not deleted',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error('Error deleting deprecation record: No data returned');
            showNotification({
              title: 'Error!',
              message: 'Oops, deprecation record was not deleted',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Removal Success!',
            message: 'Deprecation record was deleted! 🎉',
          });
          return resolve(res.data.deleteDeprecationRecord);
        }),
      ),
  };
};
