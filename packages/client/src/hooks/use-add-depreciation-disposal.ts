import {
  AddDepreciationDisposalDocument,
  type AddDepreciationDisposalMutation,
  type AddDepreciationDisposalMutationVariables,
} from '../gql/graphql.js';
import { MUTATION_DEDUPE_WINDOW_MS } from '../helpers/mutation-dedupe.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddDepreciationDisposal($input: InsertDepreciationDisposalInput!) {
    insertDepreciationDisposal(input: $input) {
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

type UseAddDepreciationDisposal = {
  fetching: boolean;
  addDepreciationDisposal: (
    variables: AddDepreciationDisposalMutationVariables,
  ) => Promise<AddDepreciationDisposalMutation['insertDepreciationDisposal'] | void>;
};

export const useAddDepreciationDisposal = (): UseAddDepreciationDisposal => {
  const { fetching, execute } = useApiMutation({
    document: AddDepreciationDisposalDocument,
    dedupe: { windowMs: MUTATION_DEDUPE_WINDOW_MS },
    notificationId: 'insertDepreciationDisposal',
    loadingMessage: 'Recording asset disposal',
    errorMessage: 'Error recording asset disposal',
    commonErrorPath: 'insertDepreciationDisposal',
    select: data => data.insertDepreciationDisposal,
    successToast: { description: 'Asset disposal was recorded' },
  });

  return { fetching, addDepreciationDisposal: execute };
};
