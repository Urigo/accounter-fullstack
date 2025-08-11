import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  AddDepreciationRecordDocument,
  type AddDepreciationRecordMutation,
  type AddDepreciationRecordMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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
  ) => Promise<AddDepreciationRecordMutation['insertDepreciationRecord'] | void>;
};

const NOTIFICATION_ID = 'insertDepreciationRecord';

export const useAddDepreciationRecord = (): UseAddDepreciationRecord => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(AddDepreciationRecordDocument);
  const addDepreciationRecord = useCallback(
    async (variables: AddDepreciationRecordMutationVariables) => {
      const message = 'Error adding depreciation record';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Adding depreciation record', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'insertDepreciationRecord');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Depreciation record was added',
          });
          return data.insertDepreciationRecord;
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
    addDepreciationRecord,
  };
};
