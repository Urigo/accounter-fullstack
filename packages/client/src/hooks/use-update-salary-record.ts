import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { graphql, ResultOf, VariablesOf } from '../graphql.js';

export const UpdateSalaryRecordDocument = graphql(`
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
`);

type SalaryRecord = Extract<
  UpdateSalaryRecordMutation['updateSalaryRecord'],
  { __typename: 'UpdateSalaryRecordSuccessfulResult' }
>['salaryRecord'];

type UpdateSalaryRecordMutationVariables = VariablesOf<typeof UpdateSalaryRecordDocument>;
type UpdateSalaryRecordMutation = ResultOf<typeof UpdateSalaryRecordDocument>;

type UseUpdateSalaryRecord = {
  fetching: boolean;
  updateSalaryRecord: (variables: UpdateSalaryRecordMutationVariables) => Promise<SalaryRecord>;
};

export const useUpdateSalaryRecord = (): UseUpdateSalaryRecord => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateSalaryRecordDocument);

  return {
    fetching,
    updateSalaryRecord: (variables: UpdateSalaryRecordMutationVariables): Promise<SalaryRecord> =>
      new Promise<SalaryRecord>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error updating salary record [${variables.salaryRecord.month}] employee [${variables.salaryRecord.employeeId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error updating salary record [${variables.salaryRecord.month}] employee [${variables.salaryRecord.employeeId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.updateSalaryRecord.__typename === 'CommonError') {
            console.error(
              `Error updating salary record [${variables.salaryRecord.month}] employee [${variables.salaryRecord.employeeId}]: ${res.data.updateSalaryRecord.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.updateSalaryRecord.message);
          }
          showNotification({
            title: 'Update Success!',
            message: 'Hey there, your update is awesome!',
          });
          return resolve(res.data.updateSalaryRecord.salaryRecord);
        }),
      ),
  };
};
