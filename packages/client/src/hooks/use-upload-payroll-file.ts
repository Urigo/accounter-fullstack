import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import { UploadPayrollFileDocument, UploadPayrollFileMutationVariables } from '../gql/graphql.js';

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

export const useUploadPayrollFile = (): UseUploadPayrollFile => {
  // TODO: add authentication
  // TODO: add local data update method after upload

  const [{ fetching }, mutate] = useMutation(UploadPayrollFileDocument);

  return {
    fetching,
    uploadPayrollFile: (variables: UploadPayrollFileMutationVariables): Promise<boolean> =>
      new Promise<boolean>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error uploading payroll file to charge ID [${variables.chargeId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error uploading payroll file to charge ID [${variables.chargeId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          if (res.data.insertSalaryRecordsFromFile !== true) {
            console.error(`Error uploading payroll file to charge ID [${variables.chargeId}]}`);
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(false);
          }
          showNotification({
            title: 'Upload Success!',
            message: 'Your payroll file was added! 🎉',
          });
          return resolve(res.data.insertSalaryRecordsFromFile);
        }),
      ),
  };
};
