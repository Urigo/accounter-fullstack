import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import {
  UpdateDynamicReportTemplateDocument,
  UpdateDynamicReportTemplateMutation,
  UpdateDynamicReportTemplateMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateDynamicReportTemplate($name: String!, $template: String!) {
    updateDynamicReportTemplate(name: $name, template: $template) {
      id
      name
    }
  }
`;

type UpdateDynamicReportTemplate =
  UpdateDynamicReportTemplateMutation['updateDynamicReportTemplate'];

type UseUpdateDynamicReportTemplate = {
  fetching: boolean;
  updateDynamicReportTemplate: (
    variables: UpdateDynamicReportTemplateMutationVariables,
  ) => Promise<UpdateDynamicReportTemplate>;
};

const NOTIFICATION_ID = 'updateDynamicReportTemplate';

export const useUpdateDynamicReportTemplate = (): UseUpdateDynamicReportTemplate => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateDynamicReportTemplateDocument);

  return {
    fetching,
    updateDynamicReportTemplate: (
      variables: UpdateDynamicReportTemplateMutationVariables,
    ): Promise<UpdateDynamicReportTemplate> =>
      new Promise<UpdateDynamicReportTemplate>((resolve, reject) => {
        notifications.show({
          id: NOTIFICATION_ID,
          loading: true,
          title: 'Updating report template',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        const genericErrorMessage = `Error updating report template "${variables.name}"`;

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
              message: `Report template "${res.data.updateDynamicReportTemplate.name}" updated`,
              withCloseButton: true,
            });
            return resolve(res.data.updateDynamicReportTemplate);
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
