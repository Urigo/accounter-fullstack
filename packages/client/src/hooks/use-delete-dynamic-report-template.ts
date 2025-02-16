import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import {
  DeleteDynamicReportTemplateDocument,
  DeleteDynamicReportTemplateMutation,
  DeleteDynamicReportTemplateMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteDynamicReportTemplate($name: String!) {
    deleteDynamicReportTemplate(name: $name)
  }
`;

type DeleteDynamicReportTemplate =
  DeleteDynamicReportTemplateMutation['deleteDynamicReportTemplate'];

type UseDeleteDynamicReportTemplate = {
  fetching: boolean;
  deleteDynamicReportTemplate: (
    variables: DeleteDynamicReportTemplateMutationVariables,
  ) => Promise<DeleteDynamicReportTemplate>;
};

const NOTIFICATION_ID = 'deleteDynamicReportTemplate';

export const useDeleteDynamicReportTemplate = (): UseDeleteDynamicReportTemplate => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(DeleteDynamicReportTemplateDocument);

  return {
    fetching,
    deleteDynamicReportTemplate: (
      variables: DeleteDynamicReportTemplateMutationVariables,
    ): Promise<DeleteDynamicReportTemplate> =>
      new Promise<DeleteDynamicReportTemplate>((resolve, reject) => {
        notifications.show({
          id: NOTIFICATION_ID,
          loading: true,
          title: 'Deleting report template',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        const genericErrorMessage = `Error deleting report template "${variables.name}"`;

        return mutate(variables)
          .then(res => {
            if (res.error) {
              console.error(`${genericErrorMessage}: ${res.error}`);
              notifications.update({
                id: NOTIFICATION_ID,
                message: genericErrorMessage,
                color: 'red',
                autoClose: 5000,
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error(`${genericErrorMessage}: No data returned`);
              notifications.update({
                id: NOTIFICATION_ID,
                message: genericErrorMessage,
                color: 'red',
                autoClose: 5000,
              });
              return reject('No data returned');
            }
            notifications.update({
              id: NOTIFICATION_ID,
              autoClose: 5000,
              message: `Report template "${res.data.deleteDynamicReportTemplate}" deleted`,
              withCloseButton: true,
            });
            return resolve(res.data.deleteDynamicReportTemplate);
          })
          .catch(error => {
            console.error(`${genericErrorMessage}: ${error}`);
            notifications.update({
              id: NOTIFICATION_ID,
              title: 'Error!',
              message: genericErrorMessage,
              color: 'red',
              autoClose: 5000,
            });
          });
      }),
  };
};
