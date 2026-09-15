import { useCallback } from 'react';
import {
  UpdateOrInsertSalaryRecordsDocument,
  type UpdateOrInsertSalaryRecordsMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateOrInsertSalaryRecords($salaryRecords: [SalaryRecordInput!]!) {
    insertOrUpdateSalaryRecords(salaryRecords: $salaryRecords) {
      __typename
      ... on InsertSalaryRecordsSuccessfulResult {
        salaryRecords {
          month
          employee {
            id
          }
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type UseUpdateOrInsertSalaryRecords = {
  fetching: boolean;
  updateOrInsertSalaryRecords: (
    variables: UpdateOrInsertSalaryRecordsMutationVariables,
  ) => Promise<{ month: string; employee?: { id: string } | null }[]>;
};

const NOTIFICATION_ID = 'insertOrUpdateSalaryRecords';

export const useUpdateOrInsertSalaryRecords = (): UseUpdateOrInsertSalaryRecords => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: UpdateOrInsertSalaryRecordsDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Updating Salary Records',
    errorMessage: 'Error updating salary records',
    commonErrorPath: 'insertOrUpdateSalaryRecords',
    select: data => data.insertOrUpdateSalaryRecords.salaryRecords,
    successToast: { description: 'Salary records were updated' },
  });

  const updateOrInsertSalaryRecords = useCallback(
    async (variables: UpdateOrInsertSalaryRecordsMutationVariables) =>
      (await execute(variables)) ?? [],
    [execute],
  );

  return {
    fetching,
    updateOrInsertSalaryRecords,
  };
};
