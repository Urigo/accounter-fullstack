import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  AccountantStatus,
  UpdateBusinessTripAccountantApprovalDocument,
  UpdateBusinessTripAccountantApprovalMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateBusinessTripAccountantApproval(
    $businessTripId: UUID!
    $status: AccountantStatus!
  ) {
    updateBusinessTripAccountantApproval(businessTripId: $businessTripId, approvalStatus: $status)
  }
`;

type UseUpdateBusinessTripAccountantApproval = {
  fetching: boolean;
  updateBusinessTripAccountantApproval: (
    variables: UpdateBusinessTripAccountantApprovalMutationVariables,
  ) => Promise<AccountantStatus>;
};

export const useUpdateBusinessTripAccountantApproval =
  (): UseUpdateBusinessTripAccountantApproval => {
    // TODO: add authentication
    // TODO: add local data update method after change

    const [{ fetching }, mutate] = useMutation(UpdateBusinessTripAccountantApprovalDocument);

    return {
      fetching,
      updateBusinessTripAccountantApproval: (
        variables: UpdateBusinessTripAccountantApprovalMutationVariables,
      ): Promise<AccountantStatus> =>
        new Promise<AccountantStatus>((resolve, reject) =>
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
              title: 'Update Success!',
              message: 'Accountant approval was updated! 🎉',
            });
            return resolve(res.data.updateBusinessTripAccountantApproval);
          }),
        ),
    };
  };
