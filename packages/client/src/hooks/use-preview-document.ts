import {
  PreviewDocumentDocument,
  type PreviewDocumentMutation,
  type PreviewDocumentMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation PreviewDocument($input: DocumentIssueInput!) {
    previewDocument(input: $input)
  }
`;

type PreviewDocument = PreviewDocumentMutation['previewDocument'];

type UsePreviewDocument = {
  fetching: boolean;
  previewDocument: (variables: PreviewDocumentMutationVariables) => Promise<PreviewDocument | void>;
};

const NOTIFICATION_ID = 'previewDocument';

export const usePreviewDocument = (): UsePreviewDocument => {
  // TODO: add authentication
  // TODO: add local caching/optimization if needed

  const { fetching, execute } = useApiMutation({
    document: PreviewDocumentDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Generating document preview...',
    errorMessage: 'Error generating document preview',
    commonErrorPath: 'previewDocument',
    select: data => data.previewDocument,
    successToast: { description: 'Document preview generated', duration: 3000 },
  });

  return {
    fetching,
    previewDocument: execute,
  };
};
