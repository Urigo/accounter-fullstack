import { gql } from 'graphql-tag';
import { UpdateChargeMutation, UpdateChargeMutationVariables, useUpdateChargeMutation } from '../__generated__/types';

gql`
  mutation UpdateCharge($chargeId: ID!, $fields: UpdateChargeInput!) {
    updateCharge(chargeId: $chargeId, fields: $fields) {
      __typename
      ... on Charge {
        id
      }
      ... on CommonError {
        message
      }
    }
  }
`;

export const useUpdateCharge = () => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const onError = async (e: unknown, { chargeId }: UpdateChargeMutationVariables) => {
    console.log(e);
    return new Error(`Error updating charge ID [${chargeId}]: ${(e as Error)?.message}`);
  };
  const onSuccess = async (data: UpdateChargeMutation) => {
    if (data.updateCharge.__typename === 'CommonError') {
      throw new Error(data.updateCharge.message);
    }
    return data.updateCharge;
  };
  return useUpdateChargeMutation({
    onError,
    onSuccess,
  });
};
