import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UnlockDynamicReportTemplateDocument,
  type UnlockDynamicReportTemplateMutation,
  type UnlockDynamicReportTemplateMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UnlockDynamicReportTemplate($name: String!) {
    unlockDynamicReportTemplate(name: $name) {
      id
      name
      isLocked
      updated
    }
  }
`;

type UseUnlockDynamicReportTemplate = {
  fetching: boolean;
  unlockDynamicReportTemplate: (
    variables: UnlockDynamicReportTemplateMutationVariables,
  ) => Promise<UnlockDynamicReportTemplateMutation['unlockDynamicReportTemplate'] | undefined>;
};

const NOTIFICATION_ID = 'unlockDynamicReportTemplate';

export const useUnlockDynamicReportTemplate = (): UseUnlockDynamicReportTemplate => {
  const [{ fetching }, mutate] = useMutation(UnlockDynamicReportTemplateDocument);

  const unlockDynamicReportTemplate = useCallback(
    async (
      variables: UnlockDynamicReportTemplateMutationVariables,
    ): Promise<UnlockDynamicReportTemplateMutation['unlockDynamicReportTemplate'] | undefined> => {
      const message = `Error unlocking report template "${variables.name}"`;
      const notificationId = `${NOTIFICATION_ID}-${variables.name}`;
      toast.loading('Unlocking report template...', { id: notificationId });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Unlocked', {
            id: notificationId,
            description: `Report template "${data.unlockDynamicReportTemplate.name}" is now unlocked`,
          });
          return data.unlockDynamicReportTemplate;
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

  return { fetching, unlockDynamicReportTemplate };
};
