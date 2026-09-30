import {
  DeleteDynamicReportCommentDocument,
  type DeleteDynamicReportCommentMutation,
  type DeleteDynamicReportCommentMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteDynamicReportComment($id: UUID!) {
    deleteDynamicReportComment(id: $id) {
      id
      deletedAt
    }
  }
`;

type DeleteDynamicReportComment = DeleteDynamicReportCommentMutation['deleteDynamicReportComment'];

type UseDeleteDynamicReportComment = {
  fetching: boolean;
  deleteDynamicReportComment: (
    variables: DeleteDynamicReportCommentMutationVariables,
  ) => Promise<DeleteDynamicReportComment | void>;
};

const NOTIFICATION_ID = 'deleteDynamicReportComment';

export const useDeleteDynamicReportComment = (): UseDeleteDynamicReportComment => {
  const { fetching, execute } = useApiMutation({
    document: DeleteDynamicReportCommentDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.id}`,
    loadingMessage: 'Deleting comment',
    errorMessage: 'Error deleting comment',
    errorDescription: error => (error instanceof Error ? error.message : 'Error deleting comment'),
    select: data => data.deleteDynamicReportComment,
    successToast: { description: 'Comment deleted' },
  });

  return {
    fetching,
    deleteDynamicReportComment: execute,
  };
};
