import {
  UpdateFinancialAccountDocument,
  type UpdateFinancialAccountMutation,
  type UpdateFinancialAccountMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: UpdateFinancialAccountDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.financialAccountId}`,
    loadingMessage: 'Updating financial account',
    errorMessage: variables =>
      `Error updating financial account ID [${variables.financialAccountId}]`,
    commonErrorPath: 'updateFinancialAccount',
    select: data => data.updateFinancialAccount,
    successToast: { description: 'Financial account updated' },
  });

  return {
    updating: fetching,
    updateFinancialAccount: execute,
  };
};
