import {
  DeleteTagDocument,
  type DeleteTagMutation,
  type DeleteTagMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteTag($tagId: UUID!) {
    deleteTag(id: $tagId)
  }
`;

/** The tag name is only used for the notifications, so it rides along with the variables. */
type DeleteTagVariables = DeleteTagMutationVariables & { name: string };

type UseDeleteTag = {
  fetching: boolean;
  deleteTag: (variables: DeleteTagVariables) => Promise<void>;
};

const NOTIFICATION_ID = 'deleteTag';

export const useDeleteTag = (): UseDeleteTag => {
  // TODO: add authentication
  // TODO: add local data update method after change

  // The variables are explicit because they carry `name` on top of the mutation's own.
  const { fetching, execute } = useApiMutation<
    DeleteTagMutation,
    DeleteTagVariables,
    undefined,
    void
  >({
    document: DeleteTagDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.tagId}`,
    loadingMessage: variables => `Deleting tag [${variables.name}]`,
    errorMessage: variables => `Error deleting new tag [${variables.name}]`,
    select: () => void 0,
    successToast: (_result, variables) => ({
      title: 'Tag Deleted',
      description: `[${variables.name}] tag was successfully removed`,
    }),
  });

  return {
    fetching,
    deleteTag: execute,
  };
};
