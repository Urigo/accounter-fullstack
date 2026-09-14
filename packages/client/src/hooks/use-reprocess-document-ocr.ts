import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  BatchReprocessDocumentsOcrDocument,
  ReprocessDocumentOcrDocument,
  type BatchReprocessDocumentsOcrMutation,
  type ReprocessDocumentOcrMutation,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation ReprocessDocumentOcr($documentId: UUID!) {
    reprocessDocumentOcr(documentId: $documentId) {
      __typename
      ... on ReprocessDocumentOcrSuccessfulResult {
        updatedFields
        document {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation BatchReprocessDocumentsOcr($documentIds: [UUID!]!) {
    batchReprocessDocumentsOcr(documentIds: $documentIds) {
      __typename
      ... on ReprocessDocumentOcrSuccessfulResult {
        updatedFields
        document {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type ReprocessResult = ReprocessDocumentOcrMutation['reprocessDocumentOcr'];
type BatchReprocessResult = BatchReprocessDocumentsOcrMutation['batchReprocessDocumentsOcr'];

type UseReprocessDocumentOcr = {
  fetching: boolean;
  /** Re-run OCR for one document and report which of its blank fields were filled. */
  reprocessDocumentOcr: (documentId: string) => Promise<ReprocessResult | void>;
  /** Re-run OCR for several documents. Each is processed independently server-side. */
  batchReprocessDocumentsOcr: (documentIds: string[]) => Promise<BatchReprocessResult | void>;
};

const NOTIFICATION_ID = 'reprocessDocumentOcr';

/**
 * OCR takes tens of seconds per document, so the loading toast is the only feedback for most of the
 * call — and a pass that legitimately extracts nothing looks identical to a failure unless it says
 * so. `updatedFields` is reported in the toast for exactly that reason.
 */
export const useReprocessDocumentOcr = (): UseReprocessDocumentOcr => {
  const [{ fetching: fetchingSingle }, mutateSingle] = useMutation(ReprocessDocumentOcrDocument);
  const [{ fetching: fetchingBatch }, mutateBatch] = useMutation(
    BatchReprocessDocumentsOcrDocument,
  );

  const reprocessDocumentOcr = useCallback(
    async (documentId: string) => {
      const message = `Error re-running OCR for document ID [${documentId}]`;
      const notificationId = `${NOTIFICATION_ID}-${documentId}`;
      toast.loading('Re-running OCR', {
        id: notificationId,
        description: 'Reading the stored file again — this can take a while',
      });
      try {
        const res = await mutateSingle({ documentId });
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          const result = data.reprocessDocumentOcr;
          if (result.__typename === 'CommonError') {
            throw new Error(result.message);
          }
          if (result.updatedFields.length === 0) {
            toast.warning('Nothing extracted', {
              id: notificationId,
              description: 'OCR ran, but found nothing this document was missing',
              duration: 100_000,
              closeButton: true,
            });
          } else {
            toast.success('Success', {
              id: notificationId,
              description: `Filled in ${result.updatedFields.join(', ')}`,
            });
          }
          return result;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: e instanceof Error ? e.message : message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutateSingle],
  );

  const batchReprocessDocumentsOcr = useCallback(
    async (documentIds: string[]) => {
      const message = 'Error re-running OCR';
      // A fixed id for the batch: joining every UUID could grow unbounded.
      const notificationId = `${NOTIFICATION_ID}-batch`;
      toast.loading(`Re-running OCR for ${documentIds.length} documents`, {
        id: notificationId,
        description: 'Reading the stored files again — this can take a while',
      });
      try {
        const res = await mutateBatch({ documentIds });
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          const results = data.batchReprocessDocumentsOcr;
          const failures = results.filter(result => result.__typename === 'CommonError');

          // Every document failed — surface the combined message through the error branch below.
          if (failures.length > 0 && failures.length === results.length) {
            throw new Error(failures.map(failure => failure.message).join('\n'));
          }

          const enriched = results.filter(
            result =>
              result.__typename === 'ReprocessDocumentOcrSuccessfulResult' &&
              result.updatedFields.length > 0,
          );

          if (failures.length > 0) {
            toast.warning('Partial success', {
              id: notificationId,
              description: `${enriched.length}/${results.length} documents were updated. ${failures.length} failed.`,
              duration: 100_000,
              closeButton: true,
            });
          } else {
            toast.success('Success', {
              id: notificationId,
              description: `${enriched.length}/${results.length} documents were updated`,
            });
          }
          return results;
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: e instanceof Error ? e.message : message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutateBatch],
  );

  return {
    fetching: fetchingSingle || fetchingBatch,
    reprocessDocumentOcr,
    batchReprocessDocumentsOcr,
  };
};
