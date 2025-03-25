import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { UploadPayrollFileDocument, UploadPayrollFileMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UploadPayrollFile($file: FileScalar!, $chargeId: UUID!) {
    insertSalaryRecordsFromFile(file: $file, chargeId: $chargeId)
  }
`;

type UseUploadPayrollFile = {
  fetching: boolean;
  uploadPayrollFile: (variables: UploadPayrollFileMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'insertSalaryRecordsFromFile';

export const useUploadPayrollFile = (): UseUploadPayrollFile => {
  // TODO: add authentication
  // TODO: add local data update method after upload

  const [{ fetching }, mutate] = useMutation(UploadPayrollFileDocument);
  const uploadPayrollFile = useCallback(
    async (variables: UploadPayrollFileMutationVariables) => {
      const message = `Error uploading payroll file to charge ID [${variables.chargeId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      toast.loading('Uploading payroll file', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(
          res,
          message,
          notificationId,
          'insertSalaryRecordsFromFile',
        );
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Payroll file added',
          });
          return data.insertSalaryRecordsFromFile;
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
      return false;
    },
    [mutate],
  );

  return {
    fetching,
    uploadPayrollFile,
  };
};
