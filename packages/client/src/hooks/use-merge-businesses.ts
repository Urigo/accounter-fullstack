import { MergeBusinessesDocument, type MergeBusinessesMutationVariables } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation MergeBusinesses($targetBusinessId: UUID!, $businessIdsToMerge: [UUID!]!) {
    mergeBusinesses(targetBusinessId: $targetBusinessId, businessIdsToMerge: $businessIdsToMerge) {
      __typename
      id
    }
  }
`;

type UseMergeBusinesses = {
  fetching: boolean;
  mergeBusinesses: (variables: MergeBusinessesMutationVariables) => Promise<string | void>;
};

const NOTIFICATION_ID = 'mergeBusinesses';

export const useMergeBusinesses = (): UseMergeBusinesses => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: MergeBusinessesDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.targetBusinessId}`,
    loadingMessage: 'Merging Businesses',
    errorMessage: variables => `Error merging into business ID [${variables.targetBusinessId}]`,
    select: data => data.mergeBusinesses.id,
    successToast: { description: 'Businesses merged' },
  });

  return {
    fetching,
    mergeBusinesses: execute,
  };
};
