import {
  AddDepreciationRecordDocument,
  type AddDepreciationRecordMutation,
  type AddDepreciationRecordMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: AddDepreciationRecordDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Adding depreciation record',
    errorMessage: 'Error adding depreciation record',
    commonErrorPath: 'insertDepreciationRecord',
    select: data => data.insertDepreciationRecord,
    successToast: { description: 'Depreciation record was added' },
  });

  return {
    fetching,
    addDepreciationRecord: execute,
  };
};
