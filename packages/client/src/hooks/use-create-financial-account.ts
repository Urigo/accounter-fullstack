import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  CreateFinancialAccountDocument,
  type CreateFinancialAccountMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CreateFinancialAccount($input: CreateFinancialAccountInput!) {
    createFinancialAccount(input: $input) {
      id
    }
  }
`;

type UseCreateFinancialAccount = {
  creating: boolean;
  createFinancialAccount: (variables: CreateFinancialAccountMutationVariables) => Promise<void>;
};

const NOTIFICATION_ID = 'createFinancialAccount';

export const useCreateFinancialAccount = (): UseCreateFinancialAccount => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(CreateFinancialAccountDocument);
  const createFinancialAccount = useCallback(
    async (variables: CreateFinancialAccountMutationVariables) => {
      const message = `Error creating new account "${variables.input.name}"`;
      const notificationId = `${NOTIFICATION_ID}-${variables.input.name}`;
      toast.loading('Creating account', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `Financial Account ${variables.input.name} was successfully created`,
          });
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
    creating: fetching,
    createFinancialAccount,
  };
};
