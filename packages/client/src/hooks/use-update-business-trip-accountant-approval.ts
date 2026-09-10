import {
  UpdateBusinessTripAccountantApprovalDocument,
  type AccountantStatus,
  type UpdateBusinessTripAccountantApprovalMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  ) => Promise<AccountantStatus | void>;
};

const NOTIFICATION_ID = 'updateBusinessTripAccountantApproval';

export const useUpdateBusinessTripAccountantApproval =
  (): UseUpdateBusinessTripAccountantApproval => {
    // TODO: add authentication
    // TODO: add local data update method after change

    const { fetching, execute } = useApiMutation({
      document: UpdateBusinessTripAccountantApprovalDocument,
      notificationId: variables => `${NOTIFICATION_ID}-${variables.businessTripId}`,
      loadingMessage: 'Updating accountant approval status',
      errorMessage: variables =>
        `Error toggling accountant approval for trip [${variables.businessTripId}]`,
      select: data => data.updateBusinessTripAccountantApproval,
      successToast: { description: 'Accountant approval status updated' },
    });

    return {
      fetching,
      updateBusinessTripAccountantApproval: execute,
    };
  };
