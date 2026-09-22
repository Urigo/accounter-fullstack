import {
  CaptureDynamicReportBaselineDocument,
  type CaptureDynamicReportBaselineMutation,
  type CaptureDynamicReportBaselineMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CaptureDynamicReportBaseline(
    $name: String!
    $tree: String!
    $snapshot: DynamicReportSnapshotInput!
  ) {
    captureDynamicReportBaseline(name: $name, tree: $tree, snapshot: $snapshot) {
      id
      name
    }
  }
`;

type CaptureDynamicReportBaseline =
  CaptureDynamicReportBaselineMutation['captureDynamicReportBaseline'];

type UseCaptureDynamicReportBaseline = {
  fetching: boolean;
  captureDynamicReportBaseline: (
    variables: CaptureDynamicReportBaselineMutationVariables,
  ) => Promise<CaptureDynamicReportBaseline | void>;
};

const NOTIFICATION_ID = 'captureDynamicReportBaseline';

export const useCaptureDynamicReportBaseline = (): UseCaptureDynamicReportBaseline => {
  const { fetching, execute } = useApiMutation({
    document: CaptureDynamicReportBaselineDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.name}`,
    loadingMessage: 'Capturing baseline',
    errorMessage: variables => `Error capturing baseline for report "${variables.name}"`,
    select: data => data.captureDynamicReportBaseline,
    successToast: template => ({
      description: `Baseline captured for "${template.name}" — changes will be tracked from here`,
    }),
  });

  return {
    fetching,
    captureDynamicReportBaseline: execute,
  };
};
