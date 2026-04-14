import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  SetAnnualAuditStep09StatusDocument,
  type SetAnnualAuditStep09StatusMutation,
  type SetAnnualAuditStep09StatusMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SetAnnualAuditStep09Status($input: SetAnnualAuditStep09StatusInput!) {
    setAnnualAuditStep09Status(input: $input) {
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

type UseSetAnnualAuditStep09Status = {
  fetching: boolean;
  setStep09Status: (
    variables: SetAnnualAuditStep09StatusMutationVariables,
  ) => Promise<SetAnnualAuditStep09StatusMutation['setAnnualAuditStep09Status'] | void>;
};

const NOTIFICATION_ID = 'setAnnualAuditStep09Status';

export const useSetAnnualAuditStep09Status = (): UseSetAnnualAuditStep09Status => {
  const [{ fetching }, mutate] = useMutation(SetAnnualAuditStep09StatusDocument);

  const setStep09Status = useCallback(
    async (
      variables: SetAnnualAuditStep09StatusMutationVariables,
    ): Promise<SetAnnualAuditStep09StatusMutation['setAnnualAuditStep09Status'] | void> => {
      const message = 'Error saving final dynamic report template selection';
      const notificationId = `${NOTIFICATION_ID}-${variables.input.ownerId}-${variables.input.year}`;
      toast.loading('Locking template...', { id: notificationId });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Template locked', {
            id: notificationId,
            description: `"${variables.input.templateName}" saved as the final dynamic report template`,
          });
          return data.setAnnualAuditStep09Status;
        }
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

  return { fetching, setStep09Status };
};
