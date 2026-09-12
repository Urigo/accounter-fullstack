import {
  InsertDynamicReportTemplateDocument,
  type InsertDynamicReportTemplateMutation,
  type InsertDynamicReportTemplateMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  ) => Promise<InsertDynamicReportTemplate | void>;
};

const NOTIFICATION_ID = 'insertDynamicReportTemplate';

export const useInsertDynamicReportTemplate = (): UseInsertDynamicReportTemplate => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: InsertDynamicReportTemplateDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.name}`,
    loadingMessage: 'Saving report template',
    errorMessage: variables => `Error inserting report template "${variables.name}"`,
    select: data => data.insertDynamicReportTemplate,
    successToast: template => ({ description: `Report template "${template.name}" saved` }),
  });

  return {
    fetching,
    insertDynamicReportTemplate: execute,
  };
};
