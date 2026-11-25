import {
  UpdateReport1214ProfileBlocksDocument,
  type UpdateReport1214ProfileBlocksMutation,
  type UpdateReport1214ProfileBlocksMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateReport1214ProfileBlocks($year: Int!, $input: Report1214ProfileInput!) {
    updateReport1214Profile(year: $year, input: $input) {
      id
      updatedAt
    }
  }
`;

/** `blockLabel` names the saved part of the profile in the notifications only. */
type UpdateReport1214ProfileBlocksVariables = UpdateReport1214ProfileBlocksMutationVariables & {
  blockLabel: string;
};

type UseUpdateReport1214ProfileBlocks = {
  fetching: boolean;
  /** Resolves to `true` once saved; failures are reported in a toast and resolve to `false`. */
  updateProfileBlocks: (variables: UpdateReport1214ProfileBlocksVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'updateReport1214ProfileBlocks';

/**
 * Saves blocks of the active business's form 1214 profile. Each provided block replaces the
 * stored one whole (`null` clears it), so callers send a complete block. The server's validation
 * messages name the row and field, so the error toast shows them verbatim.
 */
export const useUpdateReport1214ProfileBlocks = (): UseUpdateReport1214ProfileBlocks => {
  const { fetching, execute } = useApiMutation<
    UpdateReport1214ProfileBlocksMutation,
    UpdateReport1214ProfileBlocksVariables,
    undefined,
    true
  >({
    document: UpdateReport1214ProfileBlocksDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.year}-${variables.blockLabel}`,
    loadingMessage: variables => `Saving ${variables.blockLabel}`,
    errorMessage: variables => `Error saving ${variables.blockLabel}`,
    errorDescription: (error, variables) =>
      error instanceof Error ? error.message : `Error saving ${variables.blockLabel}`,
    select: () => true,
    successToast: (_result, variables) => ({
      title: 'Saved',
      description: `The form 1214 ${variables.blockLabel} of ${variables.year} are saved`,
    }),
  });

  return {
    fetching,
    updateProfileBlocks: async variables => (await execute(variables)) === true,
  };
};
