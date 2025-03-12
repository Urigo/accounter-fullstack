import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { DeleteTagDocument, DeleteTagMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteTag($tagId: UUID!) {
    deleteTag(id: $tagId)
  }
`;

type UseDeleteTag = {
  fetching: boolean;
  deleteTag: (variables: DeleteTagMutationVariables & { name: string }) => Promise<void>;
};

const NOTIFICATION_ID = '________';

export const useDeleteTag = (): UseDeleteTag => {
  // TODO: add authentication
  // TODO: add local data update method after chang e

  const [{ fetching }, mutate] = useMutation(DeleteTagDocument);
  const deleteTag = useCallback(
    async (variables: DeleteTagMutationVariables & { name: string }) => {
      const message = `Error deleting new tag [${variables.name}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.tagId}`;
      toast.loading(`Deleting tag [${variables.name}]`, {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Tag Deleted', {
            id: notificationId,
            description: `[${variables.name}] tag was successfully removed`,
          });
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    deleteTag,
  };
};
