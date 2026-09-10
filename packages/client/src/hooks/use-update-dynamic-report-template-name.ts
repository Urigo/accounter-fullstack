import {
  UpdateDynamicReportTemplateNameDocument,
  type UpdateDynamicReportTemplateNameMutation,
  type UpdateDynamicReportTemplateNameMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  ) => Promise<UpdateDynamicReportTemplateName | void>;
};

const NOTIFICATION_ID = 'updateDynamicReportTemplateName';

export const useUpdateDynamicReportTemplateName = (): UseUpdateDynamicReportTemplateName => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: UpdateDynamicReportTemplateNameDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.name}`,
    loadingMessage: 'Updating report template name',
    errorMessage: variables =>
      `Error updating report template "${variables.name}" to "${variables.newName}"`,
    select: data => data.updateDynamicReportTemplateName,
    successToast: template => ({ description: `Report template "${template.name}" updated` }),
  });

  return {
    fetching,
    updateDynamicReportTemplateName: execute,
  };
};
