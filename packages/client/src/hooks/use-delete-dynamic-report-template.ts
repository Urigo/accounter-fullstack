import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  DeleteDynamicReportTemplateDocument,
  type DeleteDynamicReportTemplateMutation,
  type DeleteDynamicReportTemplateMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(DeleteDynamicReportTemplateDocument);
  const deleteDynamicReportTemplate = useCallback(
    async (variables: DeleteDynamicReportTemplateMutationVariables) => {
      const message = `Error deleting report template "${variables.name}"`;
      const notificationId = `${NOTIFICATION_ID}-${variables.name}`;
      toast.loading('Deleting report template', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `Report template "${data.deleteDynamicReportTemplate}" deleted`,
          });
          return data.deleteDynamicReportTemplate;
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
    deleteDynamicReportTemplate,
  };
};
