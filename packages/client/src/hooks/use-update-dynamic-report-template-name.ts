import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import {
  UpdateDynamicReportTemplateNameDocument,
  UpdateDynamicReportTemplateNameMutation,
  UpdateDynamicReportTemplateNameMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateDynamicReportTemplateName($name: String!, $newName: String!) {
    updateDynamicReportTemplateName(name: $name, newName: $newName) {
      id
      name
    }
  }
`;

type UpdateDynamicReportTemplateName =
  UpdateDynamicReportTemplateNameMutation['updateDynamicReportTemplateName'];

type UseUpdateDynamicReportTemplateName = {
  fetching: boolean;
  updateDynamicReportTemplateName: (
    variables: UpdateDynamicReportTemplateNameMutationVariables,
  ) => Promise<UpdateDynamicReportTemplateName>;
};

const NOTIFICATION_ID = 'updateDynamicReportTemplateName';

export const useUpdateDynamicReportTemplateName = (): UseUpdateDynamicReportTemplateName => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateDynamicReportTemplateNameDocument);

  return {
    fetching,
    updateDynamicReportTemplateName: (
      variables: UpdateDynamicReportTemplateNameMutationVariables,
    ): Promise<UpdateDynamicReportTemplateName> =>
      new Promise<UpdateDynamicReportTemplateName>((resolve, reject) => {
        notifications.show({
          id: NOTIFICATION_ID,
          loading: true,
          title: 'Updating report template name',
          message: 'Please wait...',
          autoClose: false,
          withCloseButton: true,
        });

        const genericErrorMessage = `Error updating report template "${variables.name}" to "${variables.newName}"`;

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
              message: `Report template "${res.data.updateDynamicReportTemplateName.name}" updated`,
              withCloseButton: true,
            });
            return resolve(res.data.updateDynamicReportTemplateName);
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
