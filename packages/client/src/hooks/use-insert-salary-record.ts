import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  InsertSalaryRecordDocument,
  InsertSalaryRecordMutation,
  InsertSalaryRecordMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertSalaryRecord($salaryRecords: [SalaryRecordInput!]!) {
    insertSalaryRecords(salaryRecords: $salaryRecords) {
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

type SalaryRecord = Extract<
  InsertSalaryRecordMutation['insertSalaryRecords'],
  { __typename: 'InsertSalaryRecordsSuccessfulResult' }
>['salaryRecords'][0];

type UseInsertSalaryRecord = {
  fetching: boolean;
  insertSalaryRecord: (
    variables: InsertSalaryRecordMutationVariables,
  ) => Promise<SalaryRecord | void>;
};

const NOTIFICATION_ID = 'insertSalaryRecords';

export const useInsertSalaryRecord = (): UseInsertSalaryRecord => {
  // TODO: add authentication
  // TODO: add local data insert method after change

  const [{ fetching }, mutate] = useMutation(InsertSalaryRecordDocument);
  const insertSalaryRecord = useCallback(
    async (variables: InsertSalaryRecordMutationVariables) => {
      const notificationId = NOTIFICATION_ID;
      toast.loading('Adding salary record', {
        id: notificationId,
      });

      if (
        !variables.salaryRecords ||
        (Array.isArray(variables.salaryRecords) && variables.salaryRecords.length === 0)
      ) {
        toast.error('Error', {
          id: notificationId,
          description: 'No salary records to insert',
          duration: 100_000,
          closeButton: true,
        });
        return void 0;
      }
      const salaryRecord = Array.isArray(variables.salaryRecords)
        ? variables.salaryRecords[0]
        : variables.salaryRecords;
      if (
        !salaryRecord?.directPaymentAmount ||
        !salaryRecord?.employeeId ||
        !salaryRecord?.employer ||
        !salaryRecord?.month
      ) {
        toast.error('Error', {
          id: notificationId,
          description: 'Missing required salary record fields',
          duration: 100_000,
          closeButton: true,
        });
        return void 0;
      }

      const message = `Error adding salary record [${salaryRecord.month}] employee [${salaryRecord.employeeId}]`;

      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'insertSalaryRecords');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Salary record was added',
          });
          return data.insertSalaryRecords.salaryRecords[0];
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
    insertSalaryRecord,
  };
};
