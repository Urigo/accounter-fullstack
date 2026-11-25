import {
  DeleteDepreciationDisposalDocument,
  type DeleteDepreciationDisposalMutation,
  type DeleteDepreciationDisposalMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteDepreciationDisposal($id: UUID!) {
    deleteDepreciationDisposal(id: $id)
  }
`;

type UseDeleteDepreciationDisposal = {
  fetching: boolean;
  deleteDepreciationDisposal: (
    variables: DeleteDepreciationDisposalMutationVariables,
  ) => Promise<DeleteDepreciationDisposalMutation['deleteDepreciationDisposal'] | void>;
};

export const useDeleteDepreciationDisposal = (): UseDeleteDepreciationDisposal => {
  const { fetching, execute } = useApiMutation({
    document: DeleteDepreciationDisposalDocument,
    notificationId: variables => `deleteDepreciationDisposal-${variables.id}`,
    loadingMessage: 'Deleting asset disposal',
    errorMessage: 'Error deleting asset disposal',
    select: data => data.deleteDepreciationDisposal,
    successToast: { description: 'Asset disposal was deleted' },
  });

  return { fetching, deleteDepreciationDisposal: execute };
};
