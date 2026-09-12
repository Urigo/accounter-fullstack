import { AddTagDocument, type AddTagMutationVariables } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddTag($tagName: String!, $parentTag: UUID) {
    addTag(name: $tagName, parentId: $parentTag)
  }
`;

type UseAddTag = {
  fetching: boolean;
  addTag: (variables: AddTagMutationVariables) => Promise<void>;
};

const NOTIFICATION_ID = 'addTag';

export const useAddTag = (): UseAddTag => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: AddTagDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.tagName}`,
    loadingMessage: 'Adding tag',
    errorMessage: variables => `Error adding new tag [${variables.tagName}]`,
    select: () => void 0,
    successToast: (_result, variables) => ({
      description: `"${variables.tagName}" tag was successfully added`,
    }),
  });

  return {
    fetching,
    addTag: execute,
  };
};
