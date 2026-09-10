import {
  UpdateDepreciationRecordDocument,
  type UpdateDepreciationRecordMutation,
  type UpdateDepreciationRecordMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: UpdateDepreciationRecordDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Updating depreciation record',
    errorMessage: 'Error updating depreciation record',
    commonErrorPath: 'updateDepreciationRecord',
    select: data => data.updateDepreciationRecord,
    successToast: { description: 'Depreciation record was updated' },
  });

  return {
    fetching,
    updateDepreciationRecord: execute,
  };
};
