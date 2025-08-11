import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateOrInsertSalaryRecordsDocument,
  type UpdateOrInsertSalaryRecordsMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(UpdateOrInsertSalaryRecordsDocument);
  const updateOrInsertSalaryRecords = useCallback(
    async (variables: UpdateOrInsertSalaryRecordsMutationVariables) => {
      const message = 'Error updating salary records';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Updating Salary Records', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(
          res,
          message,
          notificationId,
          'insertOrUpdateSalaryRecords',
        );
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Salary records were updated',
          });
          return data.insertOrUpdateSalaryRecords.salaryRecords;
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
      return [];
    },
    [mutate],
  );

  return {
    fetching,
    updateOrInsertSalaryRecords,
  };
};
