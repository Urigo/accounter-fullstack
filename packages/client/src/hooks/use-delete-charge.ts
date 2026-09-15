import { useCallback } from 'react';
import { DeleteChargeDocument, type DeleteChargeMutationVariables } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteCharge($chargeId: UUID!) {
    deleteCharge(chargeId: $chargeId)
  }
`;

type UseDeleteCharge = {
  fetching: boolean;
  deleteCharge: (variables: DeleteChargeMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'deleteCharge';

export const useDeleteCharge = (): UseDeleteCharge => {
  // TODO: add authentication
  // TODO: add local data delete method after change

  const { fetching, execute } = useApiMutation({
    document: DeleteChargeDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.chargeId}`,
    loadingMessage: 'Deleting charge',
    errorMessage: variables => `Error deleting charge ID [${variables.chargeId}]`,
    select: data => {
      if (data.deleteCharge === false) {
        throw new Error('Unsuccessful deletion');
      }
      return data.deleteCharge;
    },
    successToast: { description: 'Charge was deleted' },
  });

  const deleteCharge = useCallback(
    async (variables: DeleteChargeMutationVariables) => (await execute(variables)) ?? false,
    [execute],
  );

  return {
    fetching,
    deleteCharge,
  };
};
