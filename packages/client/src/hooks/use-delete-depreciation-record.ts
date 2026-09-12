import {
  DeleteDepreciationRecordDocument,
  type DeleteDepreciationRecordMutation,
  type DeleteDepreciationRecordMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: DeleteDepreciationRecordDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.depreciationRecordId}`,
    loadingMessage: 'Deleting depreciation record',
    errorMessage: 'Error deleting depreciation record',
    select: data => data.deleteDepreciationRecord,
    successToast: { description: 'Depreciation record was deleted' },
  });

  return {
    fetching,
    deleteDepreciationRecord: execute,
  };
};
