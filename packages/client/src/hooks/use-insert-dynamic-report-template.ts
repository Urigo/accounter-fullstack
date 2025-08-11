import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  InsertDynamicReportTemplateDocument,
  type InsertDynamicReportTemplateMutation,
  type InsertDynamicReportTemplateMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(InsertDynamicReportTemplateDocument);
  const insertDynamicReportTemplate = useCallback(
    async (variables: InsertDynamicReportTemplateMutationVariables) => {
      const message = `Error inserting report template "${variables.name}"`;
      const notificationId = `${NOTIFICATION_ID}-${variables.name}`;
      toast.loading('Saving report template', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `Report template "${data.insertDynamicReportTemplate.name}" saved`,
          });
          return data.insertDynamicReportTemplate;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    insertDynamicReportTemplate,
  };
};
