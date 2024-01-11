import { GraphQLError } from 'graphql';
import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  InsertSalaryRecordDocument,
  InsertSalaryRecordMutation,
  InsertSalaryRecordMutationVariables,
} from '../gql/graphql.js';

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
  insertSalaryRecord: (variables: InsertSalaryRecordMutationVariables) => Promise<SalaryRecord>;
};

export const useInsertSalaryRecord = (): UseInsertSalaryRecord => {
  // TODO: add authentication
  // TODO: add local data insert method after change

  const [{ fetching }, mutate] = useMutation(InsertSalaryRecordDocument);

  return {
    fetching,
    insertSalaryRecord: (variables: InsertSalaryRecordMutationVariables): Promise<SalaryRecord> => {
      if (
        !variables.salaryRecords ||
        (Array.isArray(variables.salaryRecords) && variables.salaryRecords.length === 0)
      ) {
        throw new GraphQLError('No salary records to insert');
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
        throw new GraphQLError('Missing required salary record fields');
      }

      return new Promise<SalaryRecord>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error updating salary record [${salaryRecord.month}] employee [${salaryRecord.employeeId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error updating salary record [${salaryRecord.month}] employee [${salaryRecord.employeeId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.insertSalaryRecords.__typename === 'CommonError') {
            console.error(
              `Error updating salary record [${salaryRecord.month}] employee [${salaryRecord.employeeId}]: ${res.data.insertSalaryRecords.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.insertSalaryRecords.message);
          }
          showNotification({
            title: 'Insert Success!',
            message: 'Hey there, your insert is awesome!',
          });
          return resolve(res.data.insertSalaryRecords.salaryRecords[0]);
        }),
      );
    },
  };
};
