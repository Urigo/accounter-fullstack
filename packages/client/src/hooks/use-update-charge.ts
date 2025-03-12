import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateChargeDocument,
  UpdateChargeMutation,
  UpdateChargeMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateCharge($chargeId: UUID!, $fields: UpdateChargeInput!) {
    updateCharge(chargeId: $chargeId, fields: $fields) {
      __typename
      ... on UpdateChargeSuccessfulResult {
        charge {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type Charge = Extract<
  UpdateChargeMutation['updateCharge'],
  { __typename: 'UpdateChargeSuccessfulResult' }
>['charge'];

type UseUpdateCharge = {
  fetching: boolean;
  updateCharge: (variables: UpdateChargeMutationVariables) => Promise<Charge | void>;
};

const NOTIFICATION_ID = 'updateCharge';

export const useUpdateCharge = (): UseUpdateCharge => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateChargeDocument);
  const updateCharge = useCallback(
    async (variables: UpdateChargeMutationVariables) => {
      const message = `Error updating charge ID [${variables.chargeId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.chargeId}`;
      toast.loading('Updating charge', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateCharge');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Charge updated',
          });
          return data.updateCharge.charge;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    updateCharge,
  };
};
