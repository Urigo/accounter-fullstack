import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { UpdateTagDocument, type UpdateTagMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateTag($tagId: UUID!, $fields: UpdateTagFieldsInput!) {
    updateTag(id: $tagId, fields: $fields)
  }
`;

type UseUpdateTag = {
  fetching: boolean;
  updateTag: (variables: UpdateTagMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'updateTag';

export const useUpdateTag = (): UseUpdateTag => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateTagDocument);
  const updateTag = useCallback(
    async (variables: UpdateTagMutationVariables) => {
      const message = `Error updating tag ID [${variables.tagId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.tagId}`;
      toast.loading('Updating Tag...', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateTag');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Tag updated',
          });
          return data.updateTag;
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
      return false;
    },
    [mutate],
  );

  return {
    fetching,
    updateTag,
  };
};
