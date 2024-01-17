import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  ToggleChargeAccountantApprovalDocument,
  ToggleChargeAccountantApprovalMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation ToggleChargeAccountantApproval($chargeId: UUID!, $approved: Boolean!) {
    toggleChargeAccountantApproval(chargeId: $chargeId, approved: $approved)
  }
`;

type UseToggleChargeAccountantApproval = {
  fetching: boolean;
  toggleChargeAccountantApproval: (
    variables: ToggleChargeAccountantApprovalMutationVariables,
  ) => Promise<boolean>;
};

export const useToggleChargeAccountantApproval = (): UseToggleChargeAccountantApproval => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(ToggleChargeAccountantApprovalDocument);

  return {
    fetching,
    toggleChargeAccountantApproval: (
      variables: ToggleChargeAccountantApprovalMutationVariables,
    ): Promise<boolean> =>
      new Promise<boolean>((resolve, reject) =>
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
            title: 'Toggle Success!',
            message: 'Accountant approval was updated! 🎉',
          });
          return resolve(res.data.toggleChargeAccountantApproval);
        }),
      ),
  };
};
