import { showNotification } from '@mantine/notifications';
import { useMutation } from 'urql';
import {
  ToggleLedgerRecordAccountantApprovalDocument,
  ToggleLedgerRecordAccountantApprovalMutationVariables,
} from '../gql/graphql.js';

/* GraphQL */ `
  mutation ToggleLedgerRecordAccountantApproval($ledgerRecordId: ID!, $approved: Boolean!) {
    toggleLedgerRecordAccountantApproval(ledgerRecordId: $ledgerRecordId, approved: $approved)
  }
`;

export const useToggleLedgerRecordAccountantApproval = () => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(ToggleLedgerRecordAccountantApprovalDocument);

  return {
    fetching,
    toggleLedgerRecordAccountantApproval: (
      variables: ToggleLedgerRecordAccountantApprovalMutationVariables,
    ) =>
      new Promise<boolean>((resolve, reject) =>
        mutate(variables).then(res => {
          if (res.error) {
            console.error(
              `Error toggling accountant approval to ledger record ID [${variables.ledgerRecordId}]: ${res.error}`,
            );
            showNotification({
              title: 'Error!',
              message: 'Oh no!, we have an error! 🤥',
            });
            return reject(res.error.message);
          }
          if (!res.data) {
            console.error(
              `Error toggling accountant approval to ledger record ID [${variables.ledgerRecordId}]: No data returned`,
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
          return resolve(res.data.toggleLedgerRecordAccountantApproval);
        }),
      ),
  };
};
