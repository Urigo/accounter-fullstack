import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  PreviewDocumentDocument,
  type PreviewDocumentMutation,
  type PreviewDocumentMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(PreviewDocumentDocument);

  const previewDocument = useCallback(
    async (variables: PreviewDocumentMutationVariables) => {
      const message = 'Error generating document preview';
      const notificationId = NOTIFICATION_ID;

      toast.loading('Generating document preview...', {
        id: notificationId,
      });

      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'previewDocument');

        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Document preview generated',
            duration: 3000,
          });
          return data.previewDocument;
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
    previewDocument,
  };
};
