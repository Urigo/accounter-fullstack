import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  PreviewGreenInvoiceDocumentDocument,
  type PreviewGreenInvoiceDocumentMutation,
  type PreviewGreenInvoiceDocumentMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation PreviewGreenInvoiceDocument($input: NewDocumentInput!) {
    previewGreenInvoiceDocument(input: $input)
  }
`;

type PreviewGreenInvoiceDocument =
  PreviewGreenInvoiceDocumentMutation['previewGreenInvoiceDocument'];

type UsePreviewDocument = {
  fetching: boolean;
  previewDocument: (
    variables: PreviewGreenInvoiceDocumentMutationVariables,
  ) => Promise<PreviewGreenInvoiceDocument | void>;
};

const NOTIFICATION_ID = 'previewDocument';

export const usePreviewDocument = (): UsePreviewDocument => {
  // TODO: add authentication
  // TODO: add local caching/optimization if needed

  const [{ fetching }, mutate] = useMutation(PreviewGreenInvoiceDocumentDocument);

  const previewDocument = useCallback(
    async (variables: PreviewGreenInvoiceDocumentMutationVariables) => {
      const message = 'Error generating document preview';
      const notificationId = NOTIFICATION_ID;

      toast.loading('Generating document preview...', {
        id: notificationId,
      });

      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(
          res,
          message,
          notificationId,
          'previewGreenInvoiceDocument',
        );

        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Document preview generated',
            duration: 3000,
          });
          return data.previewGreenInvoiceDocument;
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
