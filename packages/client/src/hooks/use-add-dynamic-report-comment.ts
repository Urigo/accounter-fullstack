import { toast } from 'sonner';
import {
  AddDynamicReportCommentDocument,
  type AddDynamicReportCommentMutation,
  type AddDynamicReportCommentMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddDynamicReportComment($input: AddDynamicReportCommentInput!) {
    addDynamicReportComment(input: $input) {
      id
      nodeId
      resolvedAt
    }
  }
`;

type AddDynamicReportComment = AddDynamicReportCommentMutation['addDynamicReportComment'];

type UseAddDynamicReportComment = {
  fetching: boolean;
  addDynamicReportComment: (
    variables: AddDynamicReportCommentMutationVariables,
  ) => Promise<AddDynamicReportComment | void>;
};

const NOTIFICATION_ID = 'addDynamicReportComment';

export const useAddDynamicReportComment = (): UseAddDynamicReportComment => {
  const { fetching, execute } = useApiMutation({
    document: AddDynamicReportCommentDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.input.nodeId}`,
    loadingMessage: 'Posting comment',
    errorMessage: 'Error posting comment',
    // Surface the server's reason (e.g. "Template not found") rather than a generic line.
    errorDescription: error => (error instanceof Error ? error.message : 'Error posting comment'),
    select: data => data.addDynamicReportComment,
    // A conversation shouldn't raise a toast per message: the message showing up is the feedback.
    successToast: false,
    // With no success toast to replace it, the loading toast would otherwise stay up for good.
    onSuccess: (_, variables) => toast.dismiss(`${NOTIFICATION_ID}-${variables.input.nodeId}`),
  });

  return {
    fetching,
    addDynamicReportComment: execute,
  };
};
