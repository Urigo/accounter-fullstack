import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateDepreciationRecordDocument,
  type UpdateDepreciationRecordMutation,
  type UpdateDepreciationRecordMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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
  ) => Promise<UpdateDepreciationRecordMutation['updateDepreciationRecord'] | void>;
};

const NOTIFICATION_ID = 'updateDepreciationRecord';

export const useUpdateDepreciationRecord = (): UseUpdateDepreciationRecord => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(UpdateDepreciationRecordDocument);
  const updateDepreciationRecord = useCallback(
    async (variables: UpdateDepreciationRecordMutationVariables) => {
      const message = 'Error updating depreciation record';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Updating depreciation record', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateDepreciationRecord');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Depreciation record was updated',
          });
          return data.updateDepreciationRecord;
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
    updateDepreciationRecord,
  };
};
