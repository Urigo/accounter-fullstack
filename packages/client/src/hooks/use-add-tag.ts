import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { AddTagDocument, AddTagMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddTag($tagName: String!) {
    addTag(name: $tagName)
  }
`;

type UseAddTag = {
  fetching: boolean;
  addTag: (variables: AddTagMutationVariables) => Promise<void>;
};

const NOTIFICATION_ID = 'addTag';

export const useAddTag = (): UseAddTag => {
  // TODO: add authentication
  // TODO: add local data update method after chang e

  const [{ fetching }, mutate] = useMutation(AddTagDocument);
  const addTag = useCallback(
    async (variables: AddTagMutationVariables) => {
      const message = `Error adding new tag [${variables.tagName}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.tagName}`;
      toast.loading('Adding tag', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `"${variables.tagName}" tag was successfully added`,
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
    addTag,
  };
};
