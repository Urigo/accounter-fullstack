import {
  LockDynamicReportTemplateDocument,
  type LockDynamicReportTemplateMutation,
  type LockDynamicReportTemplateMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  ) => Promise<LockDynamicReportTemplateMutation['lockDynamicReportTemplate'] | void>;
};

const NOTIFICATION_ID = 'lockDynamicReportTemplate';

export const useLockDynamicReportTemplate = (): UseLockDynamicReportTemplate => {
  const { fetching, execute } = useApiMutation({
    document: LockDynamicReportTemplateDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.name}`,
    loadingMessage: 'Locking report template...',
    errorMessage: variables => `Error locking report template "${variables.name}"`,
    select: data => data.lockDynamicReportTemplate,
    successToast: template => ({
      title: 'Locked',
      description: `Report template "${template.name}" is now locked`,
    }),
  });

  return { fetching, lockDynamicReportTemplate: execute };
};
