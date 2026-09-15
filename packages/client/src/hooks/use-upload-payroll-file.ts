import { useCallback } from 'react';
import {
  UploadPayrollFileDocument,
  type UploadPayrollFileMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: UploadPayrollFileDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.chargeId}`,
    loadingMessage: 'Uploading payroll file',
    errorMessage: variables => `Error uploading payroll file to charge ID [${variables.chargeId}]`,
    commonErrorPath: 'insertSalaryRecordsFromFile',
    select: data => data.insertSalaryRecordsFromFile,
    successToast: { description: 'Payroll file added' },
  });

  const uploadPayrollFile = useCallback(
    async (variables: UploadPayrollFileMutationVariables) => (await execute(variables)) ?? false,
    [execute],
  );

  return {
    fetching,
    uploadPayrollFile,
  };
};
