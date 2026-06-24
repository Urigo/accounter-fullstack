import { log } from './logger.js';
import type { ExtractedDocument } from './mime-extractor.js';
import type {
  ControlInput,
  ControlSenderEvidence,
  IngestDocumentInput,
  IngestInput,
  ServerClient,
} from './server-client.js';
import { applyTreatment } from './treatment.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OrchestrateInput {
  recipientAlias: string;
  messageId: string;
  rawMessageHash: string;
  correlationId: string;
  receivedAt?: string;
  /** Subject header, forwarded to ingest for the human-readable charge description. */
  subject?: string;
  /** Decoded email body, consumed by treatment (body→PDF, internal-link fetch). */
  body: string;
  /** Raw attachment documents (with bytes) from MIME extraction. */
  attachments: ExtractedDocument[];
  /** Sender evidence forwarded to the control endpoint for business recognition. */
  senderEvidence?: ControlSenderEvidence;
}

export type OrchestrateResult =
  | {
      success: true;
      tenantId: string;
      outcome: 'INSERTED' | 'DUPLICATE' | 'QUARANTINED' | 'REJECTED';
      ingestId: string | null | undefined;
      existingIngestId: string | null | undefined;
      auditId: string;
      reasonCode: string | null | undefined;
    }
  | { success: false; reason: string; message: string };

export interface OrchestratorDeps {
  serverClient: Pick<ServerClient, 'requestControl' | 'requestIngest'>;
  /** Override the treatment step (default: real attachment-filter / body→PDF / link-fetch). */
  applyTreatment?: typeof applyTreatment;
}

// ---------------------------------------------------------------------------
// orchestrate
// ---------------------------------------------------------------------------

export async function orchestrate(
  input: OrchestrateInput,
  deps: OrchestratorDeps,
): Promise<OrchestrateResult> {
  const { serverClient } = deps;
  const { correlationId } = input;
  const t0 = Date.now();

  // ── Step 1: request control (resolve tenant + obtain ingest grant) ─────────
  const controlInput: ControlInput = {
    recipientAlias: input.recipientAlias,
    messageId: input.messageId,
    rawMessageHash: input.rawMessageHash,
    receivedAt: input.receivedAt,
    correlationId,
    senderEvidence: input.senderEvidence,
  };

  log('info', 'orchestrate:control:start', { recipientAlias: input.recipientAlias }, correlationId);

  const controlResult = await serverClient.requestControl(controlInput);

  if (!controlResult.success) {
    log(
      'warn',
      'orchestrate:control:denied',
      { reason: controlResult.reason, durationMs: Date.now() - t0 },
      correlationId,
    );
    return { success: false, reason: controlResult.reason, message: controlResult.message };
  }

  const { decision } = controlResult;

  log(
    'info',
    'orchestrate:control:granted',
    { tenantId: decision.tenantId, decisionId: decision.decisionId, auditId: decision.auditId },
    correlationId,
  );

  // ── Step 2: treatment — assemble the final document set from the recognized
  // business config + body + raw attachments (attachment filter, body→PDF,
  // internal-link fetch). The document set (and thus emptiness) is decided here,
  // post-recognition; the server ingest keeps a NO_DOCUMENTS quarantine backstop.
  const treat = deps.applyTreatment ?? applyTreatment;
  const finalDocuments = await treat({
    config: decision.businessEmailConfig,
    body: input.body,
    attachments: input.attachments,
    correlationId,
  });

  log(
    'info',
    'orchestrate:treatment:complete',
    {
      tenantId: decision.tenantId,
      documentCount: finalDocuments.length,
      businessId: decision.businessEmailConfig?.businessId ?? null,
    },
    correlationId,
  );

  const extractedDocuments: IngestDocumentInput[] = finalDocuments.map(doc => ({
    hash: doc.sha256,
    sizeBytes: doc.size,
    mimeType: doc.mimeType,
    filename: doc.filename,
    // Option B: inline the document bytes (base64) to the server, which uploads
    // and persists them under the recognized business in the ingest step.
    content: doc.content.toString('base64'),
  }));

  // ── Step 3: call ingest endpoint with grant + extracted documents ──────────
  // Key idempotency on the gateway-computed rawMessageHash (content-derived,
  // authoritative) rather than the sender-controlled Message-ID. Using the
  // Message-ID would let a party who can email a tenant alias pre-seed an ID so
  // a later legitimate message collapses to DUPLICATE and is silently dropped
  // (data-suppression), and would also trip on bulk senders that reuse IDs.
  const ingestInput: IngestInput = {
    grantJti: decision.grant.jti,
    idempotencyKey: input.rawMessageHash,
    tenantId: decision.tenantId,
    messageId: input.messageId,
    rawMessageHash: input.rawMessageHash,
    correlationId,
    // Descriptive metadata for the server-side charge description. `sender` is the
    // From header captured as sender evidence during extraction.
    subject: input.subject,
    sender: input.senderEvidence?.from,
    receivedAt: input.receivedAt,
    extractedDocuments,
  };

  const ingestResult = await serverClient.requestIngest(ingestInput);

  if (!ingestResult.success) {
    log(
      'warn',
      'orchestrate:ingest:failed',
      {
        reason: ingestResult.reason,
        tenantId: decision.tenantId,
        decisionId: decision.decisionId,
        auditId: decision.auditId,
        durationMs: Date.now() - t0,
      },
      correlationId,
    );
    return { success: false, reason: ingestResult.reason, message: ingestResult.message };
  }

  log(
    'info',
    'orchestrate:ingest:complete',
    {
      tenantId: decision.tenantId,
      outcome: ingestResult.outcome,
      ingestId: ingestResult.ingestId,
      auditId: ingestResult.auditId,
      reasonCode: ingestResult.reasonCode,
      durationMs: Date.now() - t0,
    },
    correlationId,
  );

  return {
    success: true,
    tenantId: decision.tenantId,
    outcome: ingestResult.outcome,
    ingestId: ingestResult.ingestId,
    existingIngestId: ingestResult.existingIngestId,
    auditId: ingestResult.auditId,
    reasonCode: ingestResult.reasonCode,
  };
}
