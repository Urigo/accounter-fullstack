import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { graphql, ResultOf, VariablesOf } from '../graphql.js';

export const UpdateOrInsertSalaryRecordsDocument = graphql(`
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
`);

export type SalaryRecordInput = VariablesOf<
  typeof UpdateOrInsertSalaryRecordsDocument
>['salaryRecords'];

type UpdateOrInsertSalaryRecordsMutationVariables = VariablesOf<
  typeof UpdateOrInsertSalaryRecordsDocument
>;
type UpdateOrInsertSalaryRecordsMutation = ResultOf<typeof UpdateOrInsertSalaryRecordsDocument>;

type UseUpdateOrInsertSalaryRecords = {
  fetching: boolean;
  updateOrInsertSalaryRecords: (
    variables: UpdateOrInsertSalaryRecordsMutationVariables,
  ) => Promise<{ month: string; employee?: { id: string } | null }[]>;
};

export const useUpdateOrInsertSalaryRecords = (): UseUpdateOrInsertSalaryRecords => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateOrInsertSalaryRecordsDocument);

  return {
    fetching,
    updateOrInsertSalaryRecords: (
      variables: UpdateOrInsertSalaryRecordsMutationVariables,
    ): Promise<{ month: string; employee?: { id: string } | null }[]> =>
      new Promise<
        Extract<
          UpdateOrInsertSalaryRecordsMutation['insertOrUpdateSalaryRecords'],
          { __typename: 'InsertSalaryRecordsSuccessfulResult' }
        >['salaryRecords']
      >((resolve, reject) =>
        mutate(variables).then(res => {
          if ('error' in res && res.error) {
            console.error(`Error updating salary records: ${res.error}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error('Error updating salary records: No data returned');
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.insertOrUpdateSalaryRecords.__typename === 'CommonError') {
            console.error(
              `Error updating salary records: ${res.data.insertOrUpdateSalaryRecords.message}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.data.insertOrUpdateSalaryRecords.message);
          }
          showNotification({
            title: 'Update Success!',
            message: 'Hey there, your update is awesome!',
          });
          return resolve(res.data.insertOrUpdateSalaryRecords.salaryRecords);
        }),
      ),
  };
};
