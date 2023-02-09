import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  ToggleChargeAccountantApprovalDocument,
  ToggleChargeAccountantApprovalMutationVariables,
} from '../gql/graphql.js';

/* GraphQL */ `
  mutation ToggleChargeAccountantApproval($chargeId: ID!, $approved: Boolean!) {
    toggleChargeAccountantApproval(chargeId: $chargeId, approved: $approved)
  }
`;

export const useToggleChargeAccountantApproval = () => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(ToggleChargeAccountantApprovalDocument);

  return {
    fetching,
    toggleChargeAccountantApproval: (variables: ToggleChargeAccountantApprovalMutationVariables) =>
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
