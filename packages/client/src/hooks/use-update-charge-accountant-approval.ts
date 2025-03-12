import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  AccountantStatus,
  UpdateChargeAccountantApprovalDocument,
  UpdateChargeAccountantApprovalMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateChargeAccountantApproval($chargeId: UUID!, $status: AccountantStatus!) {
    updateChargeAccountantApproval(chargeId: $chargeId, approvalStatus: $status)
  }
`;

type UseUpdateChargeAccountantApproval = {
  fetching: boolean;
  updateChargeAccountantApproval: (
    variables: UpdateChargeAccountantApprovalMutationVariables,
  ) => Promise<AccountantStatus | void>;
};

const NOTIFICATION_ID = 'updateChargeAccountantApproval';

export const useUpdateChargeAccountantApproval = (): UseUpdateChargeAccountantApproval => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateChargeAccountantApprovalDocument);
  const updateChargeAccountantApproval = useCallback(
    async (variables: UpdateChargeAccountantApprovalMutationVariables) => {
      const message = `Error toggling accountant approval to ledger record ID [${variables.chargeId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      toast.loading('Updating approval status', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(
          res,
          message,
          notificationId,
          'updateChargeAccountantApproval',
        );
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Accountant approval was updated',
          });
          return data.updateChargeAccountantApproval;
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
    updateChargeAccountantApproval,
  };
};
