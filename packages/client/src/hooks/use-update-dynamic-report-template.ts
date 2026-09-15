import {
  UpdateDynamicReportTemplateDocument,
  type UpdateDynamicReportTemplateMutation,
  type UpdateDynamicReportTemplateMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  ) => Promise<UpdateDynamicReportTemplate | void>;
};

const NOTIFICATION_ID = 'updateDynamicReportTemplate';

export const useUpdateDynamicReportTemplate = (): UseUpdateDynamicReportTemplate => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: UpdateDynamicReportTemplateDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.name}`,
    loadingMessage: 'Updating report template',
    errorMessage: variables => `Error updating report template "${variables.name}"`,
    select: data => data.updateDynamicReportTemplate,
    successToast: template => ({ description: `Report template "${template.name}" updated` }),
  });

  return {
    fetching,
    updateDynamicReportTemplate: execute,
  };
};
