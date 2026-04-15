import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  AnnualAuditStepStatus,
  SetAnnualAuditStepStatusDocument,
  type SetAnnualAuditStepStatusMutation,
  type SetAnnualAuditStepStatusMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

export const useSetAnnualAuditStepStatus = (): UseSetAnnualAuditStepStatus => {
  const [{ fetching }, mutate] = useMutation(SetAnnualAuditStepStatusDocument);

  const setStepStatus = useCallback(
    async (
      variables: SetAnnualAuditStepStatusMutationVariables,
    ): Promise<SetAnnualAuditStepStatusMutation['setAnnualAuditStepStatus'] | void> => {
      const { stepId, ownerId, year } = variables.input;
      const isCompleting = variables.input.status === AnnualAuditStepStatus.Completed;
      const message = `Error updating step ${stepId} status`;
      const notificationId = `${NOTIFICATION_ID}-${ownerId}-${year}-${stepId}`;
      toast.loading(isCompleting ? 'Marking as done...' : 'Updating step status...', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success(isCompleting ? 'Step marked as done' : 'Step status updated', {
            id: notificationId,
          });
          return data.setAnnualAuditStepStatus;
        }
        return undefined;
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
        });
        return undefined;
      }
    },
    [mutate],
  );

  return { fetching, setStepStatus };
};
