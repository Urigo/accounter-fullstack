import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import {
  InsertDynamicReportTemplateDocument,
  InsertDynamicReportTemplateMutation,
  InsertDynamicReportTemplateMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertDynamicReportTemplate($name: String!, $template: String!) {
    insertDynamicReportTemplate(name: $name, template: $template) {
      id
      name
    }
  }
`;

type InsertDynamicReportTemplate =
  InsertDynamicReportTemplateMutation['insertDynamicReportTemplate'];

type UseInsertDynamicReportTemplate = {
  fetching: boolean;
  insertDynamicReportTemplate: (
    variables: InsertDynamicReportTemplateMutationVariables,
  ) => Promise<InsertDynamicReportTemplate>;
};

const NOTIFICATION_ID = 'insertDynamicReportTemplate';

export const useInsertDynamicReportTemplate = (): UseInsertDynamicReportTemplate => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(InsertDynamicReportTemplateDocument);

  return {
    fetching,
    insertDynamicReportTemplate: (
      variables: InsertDynamicReportTemplateMutationVariables,
    ): Promise<InsertDynamicReportTemplate> =>
      new Promise<InsertDynamicReportTemplate>((resolve, reject) => {
        notifications.show({
          id: NOTIFICATION_ID,
          loading: true,
          title: 'Saving report template',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        const genericErrorMessage = `Error inserting report template "${variables.name}"`;

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
              message: `Report template "${res.data.insertDynamicReportTemplate.name}" saved`,
              withCloseButton: true,
            });
            return resolve(res.data.insertDynamicReportTemplate);
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
