import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateSalaryRecordDocument,
  UpdateSalaryRecordMutation,
  UpdateSalaryRecordMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(UpdateSalaryRecordDocument);
  const updateSalaryRecord = useCallback(
    async (variables: UpdateSalaryRecordMutationVariables) => {
      const message = `Error updating salary record [${variables.salaryRecord.month}] employee [${variables.salaryRecord.employeeId}]`;
      const notificationId = NOTIFICATION_ID;
      toast.loading('Updating Salary Record', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateSalaryRecord');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Salary record was updated',
          });
          return data.updateSalaryRecord.salaryRecord;
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
    updateSalaryRecord,
  };
};
