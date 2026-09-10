import {
  AnnualAuditStepStatus,
  SetAnnualAuditStepStatusDocument,
  type SetAnnualAuditStepStatusMutation,
  type SetAnnualAuditStepStatusMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SetAnnualAuditStepStatus($input: SetAnnualAuditStepStatusInput!) {
    setAnnualAuditStepStatus(input: $input) {
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

type UseSetAnnualAuditStepStatus = {
  fetching: boolean;
  setStepStatus: (
    variables: SetAnnualAuditStepStatusMutationVariables,
  ) => Promise<SetAnnualAuditStepStatusMutation['setAnnualAuditStepStatus'] | void>;
};

const NOTIFICATION_ID = 'setAnnualAuditStepStatus';

const isCompleting = (variables: SetAnnualAuditStepStatusMutationVariables) =>
  variables.input.status === AnnualAuditStepStatus.Completed;

export const useSetAnnualAuditStepStatus = (): UseSetAnnualAuditStepStatus => {
  const { fetching, execute } = useApiMutation({
    document: SetAnnualAuditStepStatusDocument,
    notificationId: ({ input }) =>
      `${NOTIFICATION_ID}-${input.ownerId}-${input.year}-${input.stepId}`,
    loadingMessage: variables =>
      isCompleting(variables) ? 'Marking as done...' : 'Updating step status...',
    errorMessage: ({ input }) => `Error updating step ${input.stepId} status`,
    select: data => data.setAnnualAuditStepStatus,
    successToast: (_result, variables) => ({
      title: isCompleting(variables) ? 'Step marked as done' : 'Step status updated',
    }),
    // This flow keeps sonner's default toast lifetime rather than the app-wide long-lived one.
    errorToast: { duration: undefined, closeButton: undefined },
  });

  return { fetching, setStepStatus: execute };
};
