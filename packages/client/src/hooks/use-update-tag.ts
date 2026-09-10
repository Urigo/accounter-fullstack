import { useCallback } from 'react';
import { UpdateTagDocument, type UpdateTagMutationVariables } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: UpdateTagDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.tagId}`,
    loadingMessage: 'Updating Tag...',
    errorMessage: variables => `Error updating tag ID [${variables.tagId}]`,
    commonErrorPath: 'updateTag',
    select: data => data.updateTag,
    successToast: { description: 'Tag updated' },
  });

  const updateTag = useCallback(
    async (variables: UpdateTagMutationVariables) => (await execute(variables)) ?? false,
    [execute],
  );

  return {
    fetching,
    updateTag,
  };
};
