import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateDynamicReportTemplateDocument,
  UpdateDynamicReportTemplateMutation,
  UpdateDynamicReportTemplateMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(UpdateDynamicReportTemplateDocument);
  const updateDynamicReportTemplate = useCallback(
    async (variables: UpdateDynamicReportTemplateMutationVariables) => {
      const message = `Error updating report template "${variables.name}"`;
      const notificationId = `${NOTIFICATION_ID}-${variables.name}`;
      toast.loading('Updating report template', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `Report template "${data.updateDynamicReportTemplate.name}" updated`,
          });
          return data.updateDynamicReportTemplate;
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
    updateDynamicReportTemplate,
  };
};
