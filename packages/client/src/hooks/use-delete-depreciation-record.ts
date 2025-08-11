import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  DeleteDepreciationRecordDocument,
  type DeleteDepreciationRecordMutation,
  type DeleteDepreciationRecordMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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
  ) => Promise<DeleteDepreciationRecordMutation['deleteDepreciationRecord'] | void>;
};

const NOTIFICATION_ID = 'deleteDepreciationRecord';

export const useDeleteDepreciationRecord = (): UseDeleteDepreciationRecord => {
  // TODO: add authentication
  // TODO: add local data delete method after delete

  const [{ fetching }, mutate] = useMutation(DeleteDepreciationRecordDocument);
  const deleteDepreciationRecord = useCallback(
    async (variables: DeleteDepreciationRecordMutationVariables) => {
      const message = 'Error deleting depreciation record';
      const notificationId = `${NOTIFICATION_ID}-${variables.depreciationRecordId}`;
      toast.loading('Deleting depreciation record', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Depreciation record was deleted',
          });
          return data.deleteDepreciationRecord;
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
    deleteDepreciationRecord,
  };
};
