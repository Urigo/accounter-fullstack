import {
  DeleteDynamicReportTemplateDocument,
  type DeleteDynamicReportTemplateMutation,
  type DeleteDynamicReportTemplateMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  ) => Promise<DeleteDynamicReportTemplate | void>;
};

const NOTIFICATION_ID = 'deleteDynamicReportTemplate';

export const useDeleteDynamicReportTemplate = (): UseDeleteDynamicReportTemplate => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: DeleteDynamicReportTemplateDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.name}`,
    loadingMessage: 'Deleting report template',
    errorMessage: variables => `Error deleting report template "${variables.name}"`,
    select: data => data.deleteDynamicReportTemplate,
    successToast: name => ({ description: `Report template "${name}" deleted` }),
  });

  return {
    fetching,
    deleteDynamicReportTemplate: execute,
  };
};
