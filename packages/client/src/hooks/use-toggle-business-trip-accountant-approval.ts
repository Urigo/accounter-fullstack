import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  ToggleBusinessTripAccountantApprovalDocument,
  ToggleBusinessTripAccountantApprovalMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation ToggleBusinessTripAccountantApproval($businessTripId: UUID!, $approved: Boolean!) {
    toggleBusinessTripAccountantApproval(businessTripId: $businessTripId, approved: $approved)
  }
`;

type UseToggleBusinessTripAccountantApproval = {
  fetching: boolean;
  toggleBusinessTripAccountantApproval: (
    variables: ToggleBusinessTripAccountantApprovalMutationVariables,
  ) => Promise<boolean>;
};

export const useToggleBusinessTripAccountantApproval =
  (): UseToggleBusinessTripAccountantApproval => {
    // TODO: add authentication
    // TODO: add local data update method after change

    const [{ fetching }, mutate] = useMutation(ToggleBusinessTripAccountantApprovalDocument);

    return {
      fetching,
      toggleBusinessTripAccountantApproval: (
        variables: ToggleBusinessTripAccountantApprovalMutationVariables,
      ): Promise<boolean> =>
        new Promise<boolean>((resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(
                `Error toggling accountant approval to ledger record ID [${variables.businessTripId}]: ${res.error}`,
              );
              showNotification({
                title: 'Error!',
                message: 'Oh no!, we have an error! 🤥',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error(
                `Error toggling accountant approval to ledger record ID [${variables.businessTripId}]: No data returned`,
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
            return resolve(res.data.toggleBusinessTripAccountantApproval);
          }),
        ),
    };
  };
