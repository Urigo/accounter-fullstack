import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateFinancialAccountDocument,
  type UpdateFinancialAccountMutation,
  type UpdateFinancialAccountMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateFinancialAccount(
    $financialAccountId: UUID!
    $fields: UpdateFinancialAccountInput!
  ) {
    updateFinancialAccount(id: $financialAccountId, fields: $fields) {
      id
    }
  }
`;

type FinancialAccount = UpdateFinancialAccountMutation['updateFinancialAccount'];

type UseUpdateFinancialAccount = {
  updating: boolean;
  updateFinancialAccount: (
    variables: UpdateFinancialAccountMutationVariables,
  ) => Promise<FinancialAccount | void>;
};

const NOTIFICATION_ID = 'updateFinancialAccount';

export const useUpdateFinancialAccount = (): UseUpdateFinancialAccount => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateFinancialAccountDocument);
  const updateFinancialAccount = useCallback(
    async (variables: UpdateFinancialAccountMutationVariables) => {
      const message = `Error updating financial account ID [${variables.financialAccountId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.financialAccountId}`;
      toast.loading('Updating financial account', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateFinancialAccount');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Financial account updated',
          });
          return data.updateFinancialAccount;
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
    updating: fetching,
    updateFinancialAccount,
  };
};
