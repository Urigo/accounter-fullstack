import {
  UpdateChargeDocument,
  type UpdateChargeMutation,
  type UpdateChargeMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: UpdateChargeDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.chargeId}`,
    loadingMessage: 'Updating charge',
    errorMessage: variables => `Error updating charge ID [${variables.chargeId}]`,
    commonErrorPath: 'updateCharge',
    select: data => data.updateCharge.charge,
    successToast: { description: 'Charge updated' },
  });

  return {
    fetching,
    updateCharge: execute,
  };
};
