import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateDynamicReportTemplateNameDocument,
  type UpdateDynamicReportTemplateNameMutation,
  type UpdateDynamicReportTemplateNameMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(UpdateDynamicReportTemplateNameDocument);
  const updateDynamicReportTemplateName = useCallback(
    async (variables: UpdateDynamicReportTemplateNameMutationVariables) => {
      const message = `Error updating report template "${variables.name}" to "${variables.newName}"`;
      const notificationId = `${NOTIFICATION_ID}-${variables.name}`;
      toast.loading('Updating report template name', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `Report template "${data.updateDynamicReportTemplateName.name}" updated`,
          });
          return data.updateDynamicReportTemplateName;
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
    updateDynamicReportTemplateName,
  };
};
