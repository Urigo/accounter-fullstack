import {
  UpdateDepreciationDisposalDocument,
  type UpdateDepreciationDisposalMutation,
  type UpdateDepreciationDisposalMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateDepreciationDisposal($input: UpdateDepreciationDisposalInput!) {
    updateDepreciationDisposal(input: $input) {
      __typename
      ... on CommonError {
        message
      }
      ... on DepreciationDisposal {
        id
      }
    }
  }
`;

type UseUpdateDepreciationDisposal = {
  fetching: boolean;
  updateDepreciationDisposal: (
    variables: UpdateDepreciationDisposalMutationVariables,
  ) => Promise<UpdateDepreciationDisposalMutation['updateDepreciationDisposal'] | void>;
};

export const useUpdateDepreciationDisposal = (): UseUpdateDepreciationDisposal => {
  const { fetching, execute } = useApiMutation({
    document: UpdateDepreciationDisposalDocument,
    notificationId: variables => `updateDepreciationDisposal-${variables.input.id}`,
    loadingMessage: 'Updating asset disposal',
    errorMessage: 'Error updating asset disposal',
    commonErrorPath: 'updateDepreciationDisposal',
    select: data => data.updateDepreciationDisposal,
    successToast: { description: 'Asset disposal was updated' },
  });

  return { fetching, updateDepreciationDisposal: execute };
};
