import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  InsertSalaryRecordDocument,
  type InsertSalaryRecordMutation,
  type InsertSalaryRecordMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

/** The single record being inserted, or `undefined` when the input can't produce one. */
const firstSalaryRecord = (variables: InsertSalaryRecordMutationVariables) =>
  Array.isArray(variables.salaryRecords) ? variables.salaryRecords[0] : variables.salaryRecords;

export const useInsertSalaryRecord = (): UseInsertSalaryRecord => {
  // TODO: add authentication
  // TODO: add local data insert method after change

  const { fetching, execute } = useApiMutation({
    document: InsertSalaryRecordDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Adding salary record',
    errorMessage: variables => {
      const salaryRecord = firstSalaryRecord(variables);
      return `Error adding salary record [${salaryRecord?.month}] employee [${salaryRecord?.employeeId}]`;
    },
    commonErrorPath: 'insertSalaryRecords',
    select: data => data.insertSalaryRecords.salaryRecords[0],
    successToast: { description: 'Salary record was added' },
  });

  const insertSalaryRecord = useCallback(
    async (variables: InsertSalaryRecordMutationVariables) => {
      // Guard before the mutation: the server would reject these anyway, and reporting them here
      // keeps the message specific about which field is missing.
      const rejectWith = (description: string) => {
        toast.error('Error', {
          id: NOTIFICATION_ID,
          description,
          duration: 100_000,
          closeButton: true,
        });
        return void 0;
      };

      if (
        !variables.salaryRecords ||
        (Array.isArray(variables.salaryRecords) && variables.salaryRecords.length === 0)
      ) {
        return rejectWith('No salary records to insert');
      }

      const salaryRecord = firstSalaryRecord(variables);
      if (
        !salaryRecord?.directPaymentAmount ||
        !salaryRecord?.employeeId ||
        !salaryRecord?.employer ||
        !salaryRecord?.month
      ) {
        return rejectWith('Missing required salary record fields');
      }

      return execute(variables);
    },
    [execute],
  );

  return {
    fetching,
    insertSalaryRecord,
  };
};
