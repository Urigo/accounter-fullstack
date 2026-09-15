import {
  UpdateChargeAccountantApprovalDocument,
  type AccountantStatus,
  type UpdateChargeAccountantApprovalMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: UpdateChargeAccountantApprovalDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.chargeId}`,
    loadingMessage: 'Updating approval status',
    errorMessage: variables =>
      `Error toggling accountant approval to ledger record ID [${variables.chargeId}]`,
    commonErrorPath: 'updateChargeAccountantApproval',
    select: data => data.updateChargeAccountantApproval,
    successToast: { description: 'Accountant approval was updated' },
  });

  return {
    fetching,
    updateChargeAccountantApproval: execute,
  };
};
