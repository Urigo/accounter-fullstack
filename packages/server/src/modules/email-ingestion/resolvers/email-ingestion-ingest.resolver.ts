import { IngestOutcome } from '../contracts.js';
import { EmailIngestionIngestProvider } from '../providers/email-ingestion-ingest.provider.js';
import type { EmailIngestionModule } from '../types.js';

const OUTCOME_MAP: Record<IngestOutcome, EmailIngestionModule.IngestOutcome> = {
  [IngestOutcome.INSERTED]: 'INSERTED',
  [IngestOutcome.DUPLICATE]: 'DUPLICATE',
  [IngestOutcome.QUARANTINED]: 'QUARANTINED',
  [IngestOutcome.REJECTED]: 'REJECTED',
};

const ingestEmail: EmailIngestionModule.MutationResolvers['ingestEmail'] = async (
  _parent,
  { input },
  { injector },
) => {
  const ingestProvider = injector.get(EmailIngestionIngestProvider);

  try {
    const result = await ingestProvider.performIngest(
      {
        grantJti: input.grantJti,
        idempotencyKey: input.idempotencyKey,
        tenantId: input.tenantId,
        messageId: input.messageId,
        rawMessageHash: input.rawMessageHash,
        correlationId: input.correlationId ?? undefined,
        subject: input.subject ?? undefined,
        sender: input.sender ?? undefined,
        receivedAt: input.receivedAt ?? undefined,
        extractedDocuments: input.extractedDocuments.map(doc => ({
          hash: doc.hash,
          sizeBytes: doc.sizeBytes,
          mimeType: doc.mimeType,
          filename: doc.filename ?? undefined,
          content: doc.content ?? undefined,
        })),
      },
      // Pass the operation injector so the provider can run OCR (getOcrData →
      // AnthropicProvider) without injecting an Injector into the singleton.
      injector,
    );

    const outcome = OUTCOME_MAP[result.outcome];

    return {
      __typename: 'IngestEmailSuccess',
      outcome,
      ingestId: 'ingestId' in result ? result.ingestId : null,
      existingIngestId: 'existingIngestId' in result ? result.existingIngestId : null,
      auditId: 'auditId' in result ? result.auditId : '',
      reasonCode: 'reasonCode' in result ? result.reasonCode : null,
    };
  } catch (error) {
    // Log the real cause before collapsing to a generic CommonError. performIngest
    // does fallible, non-transactional work (Cloudinary upload, OCR, document
    // inserts); without this line those failures are invisible server-side and the
    // only trace of a stranded email is a consumed grant with no document —
    // exactly the case this handler exists to make diagnosable. Key by
    // correlationId/messageId so it joins back to the gateway logs.
    console.error(
      `Failed to process email ingest request (correlationId: ${
        input.correlationId ?? 'none'
      }, messageId: ${input.messageId}):`,
      error,
    );
    return {
      __typename: 'CommonError',
      message: 'Failed to process email ingest request',
    };
  }
};

export const emailIngestionIngestResolver = {
  Mutation: {
    ingestEmail,
  },
};
