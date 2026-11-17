import {
  SetAnnualAuditWorkingTemplateDocument,
  type SetAnnualAuditWorkingTemplateMutation,
  type SetAnnualAuditWorkingTemplateMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';
import { reportTypeLabel } from './use-set-annual-audit-step09-status.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SetAnnualAuditWorkingTemplate($input: SetAnnualAuditWorkingTemplateInput!) {
    setAnnualAuditWorkingTemplate(input: $input) {
      id
      ownerId
      year
      stepId
      status
      notes
      evidence
      updatedAt
      completedAt
    }
  }
`;

type UseSetAnnualAuditWorkingTemplate = {
  fetching: boolean;
  setWorkingTemplate: (
    variables: SetAnnualAuditWorkingTemplateMutationVariables,
  ) => Promise<SetAnnualAuditWorkingTemplateMutation['setAnnualAuditWorkingTemplate'] | void>;
};

const NOTIFICATION_ID = 'setAnnualAuditWorkingTemplate';

export const useSetAnnualAuditWorkingTemplate = (): UseSetAnnualAuditWorkingTemplate => {
  const { fetching, execute } = useApiMutation({
    document: SetAnnualAuditWorkingTemplateDocument,
    notificationId: ({ input }) =>
      `${NOTIFICATION_ID}-${input.ownerId}-${input.year}-${input.reportType ?? 'ALL'}`,
    loadingMessage: 'Saving working template...',
    errorMessage: 'Error saving working dynamic report template',
    select: data => data.setAnnualAuditWorkingTemplate,
    successToast: (_result, { input }) => ({
      title: 'Working template updated',
      description: input.templateName
        ? `${reportTypeLabel(input.reportType)}: "${input.templateName}"`
        : `${reportTypeLabel(input.reportType)}: back to last year's template`,
    }),
    // This flow keeps sonner's default toast lifetime rather than the app-wide long-lived one.
    errorToast: { duration: undefined, closeButton: undefined },
  });

  return { fetching, setWorkingTemplate: execute };
};
