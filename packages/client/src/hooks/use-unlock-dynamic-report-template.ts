import {
  UnlockDynamicReportTemplateDocument,
  type UnlockDynamicReportTemplateMutation,
  type UnlockDynamicReportTemplateMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  ) => Promise<UnlockDynamicReportTemplateMutation['unlockDynamicReportTemplate'] | void>;
};

const NOTIFICATION_ID = 'unlockDynamicReportTemplate';

export const useUnlockDynamicReportTemplate = (): UseUnlockDynamicReportTemplate => {
  const { fetching, execute } = useApiMutation({
    document: UnlockDynamicReportTemplateDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.name}`,
    loadingMessage: 'Unlocking report template...',
    errorMessage: variables => `Error unlocking report template "${variables.name}"`,
    select: data => data.unlockDynamicReportTemplate,
    successToast: template => ({
      title: 'Unlocked',
      description: `Report template "${template.name}" is now unlocked`,
    }),
  });

  return { fetching, unlockDynamicReportTemplate: execute };
};
