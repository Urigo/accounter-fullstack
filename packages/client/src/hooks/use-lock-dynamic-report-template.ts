import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  LockDynamicReportTemplateDocument,
  type LockDynamicReportTemplateMutation,
  type LockDynamicReportTemplateMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation LockDynamicReportTemplate($name: String!) {
    lockDynamicReportTemplate(name: $name) {
      id
      name
      isLocked
      updated
    }
  }
`;

type UseLockDynamicReportTemplate = {
  fetching: boolean;
  lockDynamicReportTemplate: (
    variables: LockDynamicReportTemplateMutationVariables,
  ) => Promise<LockDynamicReportTemplateMutation['lockDynamicReportTemplate'] | undefined>;
};

const NOTIFICATION_ID = 'lockDynamicReportTemplate';

export const useLockDynamicReportTemplate = (): UseLockDynamicReportTemplate => {
  const [{ fetching }, mutate] = useMutation(LockDynamicReportTemplateDocument);

  const lockDynamicReportTemplate = useCallback(
    async (
      variables: LockDynamicReportTemplateMutationVariables,
    ): Promise<LockDynamicReportTemplateMutation['lockDynamicReportTemplate'] | undefined> => {
      const message = `Error locking report template "${variables.name}"`;
      const notificationId = `${NOTIFICATION_ID}-${variables.name}`;
      toast.loading('Locking report template...', { id: notificationId });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Locked', {
            id: notificationId,
            description: `Report template "${data.lockDynamicReportTemplate.name}" is now locked`,
          });
          return data.lockDynamicReportTemplate;
        }
        return undefined;
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
        return undefined;
      }
    },
    [mutate],
  );

  return { fetching, lockDynamicReportTemplate };
};
