import {
  SetDynamicReportThreadResolvedDocument,
  type SetDynamicReportThreadResolvedMutation,
  type SetDynamicReportThreadResolvedMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SetDynamicReportThreadResolved($threadId: UUID!, $resolved: Boolean!) {
    setDynamicReportThreadResolved(threadId: $threadId, resolved: $resolved) {
      id
      resolvedAt
    }
  }
`;

type SetDynamicReportThreadResolved =
  SetDynamicReportThreadResolvedMutation['setDynamicReportThreadResolved'];

type UseSetDynamicReportThreadResolved = {
  fetching: boolean;
  setDynamicReportThreadResolved: (
    variables: SetDynamicReportThreadResolvedMutationVariables,
  ) => Promise<SetDynamicReportThreadResolved | void>;
};

const NOTIFICATION_ID = 'setDynamicReportThreadResolved';

export const useSetDynamicReportThreadResolved = (): UseSetDynamicReportThreadResolved => {
  const { fetching, execute } = useApiMutation({
    document: SetDynamicReportThreadResolvedDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.threadId}`,
    loadingMessage: variables => (variables.resolved ? 'Resolving thread' : 'Reopening thread'),
    errorMessage: variables =>
      variables.resolved ? 'Error resolving thread' : 'Error reopening thread',
    errorDescription: (error, variables) =>
      error instanceof Error
        ? error.message
        : variables.resolved
          ? 'Error resolving thread'
          : 'Error reopening thread',
    select: data => data.setDynamicReportThreadResolved,
    successToast: (_, variables) => ({
      description: variables.resolved ? 'Thread resolved' : 'Thread reopened',
    }),
  });

  return {
    fetching,
    setDynamicReportThreadResolved: execute,
  };
};
