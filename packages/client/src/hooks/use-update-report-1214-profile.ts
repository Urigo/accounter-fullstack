import {
  UpdateReport1214ProfileDocument,
  type UpdateReport1214ProfileMutation,
  type UpdateReport1214ProfileMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateReport1214Profile($year: Int!, $input: Report1214ProfileInput!) {
    updateReport1214Profile(year: $year, input: $input) {
      id
      updatedAt
    }
  }
`;

type UpdateReport1214ProfileVariables = UpdateReport1214ProfileMutationVariables & {
  /** What is being saved, for the notifications (e.g. "company details"). */
  blockName: string;
};

type UseUpdateReport1214Profile = {
  fetching: boolean;
  /** The message of the last failed save, as the server phrased it. */
  errorMessage: string | undefined;
  /** Saves the given profile blocks; resolves to `true` once saved. */
  updateReport1214Profile: (variables: UpdateReport1214ProfileVariables) => Promise<boolean>;
};

/**
 * Saves blocks of the active business's form 1214 profile. Each provided block replaces the stored
 * one and `null` clears it, so callers send whole blocks. `ownerId` is left out: the server writes
 * the active business's profile only.
 */
export const useUpdateReport1214Profile = (): UseUpdateReport1214Profile => {
  const { fetching, error, execute } = useApiMutation<
    UpdateReport1214ProfileMutation,
    UpdateReport1214ProfileVariables,
    undefined,
    true
  >({
    document: UpdateReport1214ProfileDocument,
    notificationId: variables => `updateReport1214Profile-${variables.year}-${variables.blockName}`,
    loadingMessage: variables => `Saving the form 1214 ${variables.blockName}`,
    errorMessage: variables => `Error saving the form 1214 ${variables.blockName}`,
    // The server's message names the field it rejected: show it as is
    errorDescription: (e, variables) =>
      e instanceof Error ? e.message : `Error saving the form 1214 ${variables.blockName}`,
    select: () => true,
    successToast: (_result, variables) => ({
      title: 'Saved',
      description: `The form 1214 ${variables.blockName} for ${variables.year} were saved`,
    }),
  });

  return {
    fetching,
    errorMessage: error ? (error.graphQLErrors[0]?.message ?? error.message) : undefined,
    updateReport1214Profile: async variables => (await execute(variables)) === true,
  };
};
