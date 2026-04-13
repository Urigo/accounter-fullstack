import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  SetAnnualAuditStep03StatusDocument,
  type SetAnnualAuditStep03StatusMutation,
  type SetAnnualAuditStep03StatusMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SetAnnualAuditStep03Status($input: SetAnnualAuditStep03StatusInput!) {
    setAnnualAuditStep03Status(input: $input) {
      id
      ownerId
      year
      stepId
      status
      notes
      updatedAt
      completedAt
    }
  }
`;

type UseSetAnnualAuditStep03Status = {
  fetching: boolean;
  setStep03Status: (
    variables: SetAnnualAuditStep03StatusMutationVariables,
  ) => Promise<SetAnnualAuditStep03StatusMutation['setAnnualAuditStep03Status'] | void>;
};

const NOTIFICATION_ID = 'setAnnualAuditStep03Status';

export const useSetAnnualAuditStep03Status = (): UseSetAnnualAuditStep03Status => {
  const [{ fetching }, mutate] = useMutation(SetAnnualAuditStep03StatusDocument);

  const setStep03Status = useCallback(
    async (
      variables: SetAnnualAuditStep03StatusMutationVariables,
    ): Promise<SetAnnualAuditStep03StatusMutation['setAnnualAuditStep03Status'] | void> => {
      const message = 'Error saving opening balance approval';
      const notificationId = `${NOTIFICATION_ID}-${variables.input.ownerId}-${variables.input.year}`;
      toast.loading('Saving approval...', { id: notificationId });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Saved', {
            id: notificationId,
            description: 'Opening balance approval updated',
          });
          return data.setAnnualAuditStep03Status;
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

  return { fetching, setStep03Status };
};
