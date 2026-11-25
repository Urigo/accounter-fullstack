import { useCallback, useRef } from 'react';
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

type UseUpdateReport1214Profile = {
  fetching: boolean;
  /**
   * Saves the given profile blocks; resolves to `true` once saved. `blockName` names what is saved
   * in the notifications (e.g. "company details"). A failure is reported by the error toast, which
   * carries the server's message.
   */
  updateReport1214Profile: (
    variables: UpdateReport1214ProfileMutationVariables,
    blockName: string,
  ) => Promise<boolean>;
};

/**
 * Saves blocks of the active business's form 1214 profile. Each provided block replaces the stored
 * one and `null` clears it, so callers send whole blocks. `ownerId` is left out: the server writes
 * the active business's profile only.
 */
export const useUpdateReport1214Profile = (): UseUpdateReport1214Profile => {
  // Read by the notification callbacks, which only get the GraphQL variables
  const blockName = useRef('profile');
  const { fetching, execute } = useApiMutation<
    UpdateReport1214ProfileMutation,
    UpdateReport1214ProfileMutationVariables,
    undefined,
    true
  >({
    document: UpdateReport1214ProfileDocument,
    notificationId: variables => `updateReport1214Profile-${variables.year}-${blockName.current}`,
    loadingMessage: () => `Saving the form 1214 ${blockName.current}`,
    errorMessage: () => `Error saving the form 1214 ${blockName.current}`,
    select: () => true,
    successToast: (_result, variables) => ({
      title: 'Saved',
      description: `Saved the form 1214 ${blockName.current} for ${variables.year}`,
    }),
  });

  const updateReport1214Profile = useCallback(
    async (variables: UpdateReport1214ProfileMutationVariables, name: string) => {
      blockName.current = name;
      return (await execute(variables)) === true;
    },
    [execute],
  );

  return { fetching, updateReport1214Profile };
};
