import { useCallback } from 'react';
import { CloseDocumentDocument, type CloseDocumentMutationVariables } from '../gql/graphql.js';
import { MUTATION_DEDUPE_WINDOW_MS } from '../helpers/mutation-dedupe.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CloseDocument($documentId: UUID!) {
    closeDocument(id: $documentId)
  }
`;

type UseCloseDocument = {
  fetching: boolean;
  closeDocument: (variables: CloseDocumentMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'closeDocument';

export const useCloseDocument = (): UseCloseDocument => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: CloseDocumentDocument,
    dedupe: { windowMs: MUTATION_DEDUPE_WINDOW_MS },
    notificationId: variables => `${NOTIFICATION_ID}-${variables.documentId}`,
    loadingMessage: 'Closing Document...',
    errorMessage: variables => `Error closing document ID [${variables.documentId}]`,
    commonErrorPath: 'closeDocument',
    select: data => data.closeDocument,
    successToast: { description: 'Document closed' },
  });

  const closeDocument = useCallback(
    async (variables: CloseDocumentMutationVariables) => (await execute(variables)) ?? false,
    [execute],
  );

  return {
    fetching,
    closeDocument,
  };
};
