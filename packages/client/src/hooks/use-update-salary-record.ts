import {
  UpdateSalaryRecordDocument,
  type UpdateSalaryRecordMutation,
  type UpdateSalaryRecordMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateSalaryRecord($salaryRecord: SalaryRecordEditInput!) {
    updateSalaryRecord(salaryRecord: $salaryRecord) {
      __typename
      ... on UpdateSalaryRecordSuccessfulResult {
        salaryRecord {
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

type SalaryRecord = Extract<
  UpdateSalaryRecordMutation['updateSalaryRecord'],
  { __typename: 'UpdateSalaryRecordSuccessfulResult' }
>['salaryRecord'];

type UseUpdateSalaryRecord = {
  fetching: boolean;
  updateSalaryRecord: (
    variables: UpdateSalaryRecordMutationVariables,
  ) => Promise<SalaryRecord | void>;
};

const NOTIFICATION_ID = 'updateSalaryRecord';

export const useUpdateSalaryRecord = (): UseUpdateSalaryRecord => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: UpdateSalaryRecordDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Updating Salary Record',
    errorMessage: ({ salaryRecord }) =>
      `Error updating salary record [${salaryRecord.month}] employee [${salaryRecord.employeeId}]`,
    commonErrorPath: 'updateSalaryRecord',
    select: data => data.updateSalaryRecord.salaryRecord,
    successToast: { description: 'Salary record was updated' },
  });

  return {
    fetching,
    updateSalaryRecord: execute,
  };
};
