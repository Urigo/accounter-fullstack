import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  AccountantStatus,
  UpdateChargeAccountantApprovalDocument,
  UpdateChargeAccountantApprovalMutationVariables,
} from '../gql/graphql.js';

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
  ) => Promise<AccountantStatus>;
};

export const useUpdateChargeAccountantApproval = (): UseUpdateChargeAccountantApproval => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateChargeAccountantApprovalDocument);

  return {
    fetching,
    updateChargeAccountantApproval: (
      variables: UpdateChargeAccountantApprovalMutationVariables,
    ): Promise<AccountantStatus> =>
      new Promise<AccountantStatus>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error toggling accountant approval to ledger record ID [${variables.chargeId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error toggling accountant approval to ledger record ID [${variables.chargeId}]: No data returned`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject('No data returned');
          }
          showNotification({
            title: 'Update Success!',
            message: 'Accountant approval was updated! 🎉',
          });
          return resolve(res.data.updateChargeAccountantApproval);
        }),
      ),
  };
};
