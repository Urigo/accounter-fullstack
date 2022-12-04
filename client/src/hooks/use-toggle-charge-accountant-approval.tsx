import { gql } from 'graphql-tag';

import {
  ToggleChargeAccountantApprovalMutation,
  ToggleChargeAccountantApprovalMutationVariables,
  useToggleChargeAccountantApprovalMutation,
} from '../__generated__/types';

gql`
  mutation ToggleChargeAccountantApproval($chargeId: ID!, $approved: Boolean!) {
    toggleChargeAccountantApproval(chargeId: $chargeId, approved: $approved)
  }
`;

export const useToggleChargeAccountantApproval = () => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const onError = async (e: unknown, { chargeId }: ToggleChaergeAccountantApprovalMutationVariables) => {
    console.log(e);
    return new Error(
      `Error updating accountant approval of charge ID [${chargeId}]: ${(e as Error)?.message}`
    );
  };
  const onSuccess = async (data: ToggleChargeAccountantApprovalMutation) => {
    return data.toggleChargeAccountantApproval;
  };
  return useToggleChargeAccountantApprovalMutation({
    onError,
    onSuccess,
  });
};
