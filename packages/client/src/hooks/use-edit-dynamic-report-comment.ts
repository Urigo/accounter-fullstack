import {
  EditDynamicReportCommentDocument,
  type EditDynamicReportCommentMutation,
  type EditDynamicReportCommentMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation EditDynamicReportComment($id: UUID!, $content: String!) {
    editDynamicReportComment(id: $id, content: $content) {
      id
      content
      editedAt
    }
  }
`;

type EditDynamicReportComment = EditDynamicReportCommentMutation['editDynamicReportComment'];

type UseEditDynamicReportComment = {
  fetching: boolean;
  editDynamicReportComment: (
    variables: EditDynamicReportCommentMutationVariables,
  ) => Promise<EditDynamicReportComment | void>;
};

const NOTIFICATION_ID = 'editDynamicReportComment';

export const useEditDynamicReportComment = (): UseEditDynamicReportComment => {
  const { fetching, execute } = useApiMutation({
    document: EditDynamicReportCommentDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.id}`,
    loadingMessage: 'Saving comment',
    errorMessage: 'Error saving comment',
    errorDescription: error => (error instanceof Error ? error.message : 'Error saving comment'),
    select: data => data.editDynamicReportComment,
    successToast: { description: 'Comment updated' },
  });

  return {
    fetching,
    editDynamicReportComment: execute,
  };
};
