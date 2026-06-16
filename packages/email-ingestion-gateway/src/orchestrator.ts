import { log } from './logger.js';
import type {
  ControlInput,
  IngestDocumentInput,
  IngestInput,
  ServerClient,
} from './server-client.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OrchestrateInput {
  recipientAlias: string;
  messageId: string;
  rawMessageHash: string;
  correlationId: string;
  receivedAt?: string;
  extractedDocuments: IngestDocumentInput[];
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

  // ── Step 2: call ingest endpoint with grant + extracted documents ──────────
  const ingestInput: IngestInput = {
    grantJti: decision.grant.jti,
    idempotencyKey: input.messageId,
    tenantId: decision.tenantId,
    messageId: input.messageId,
    rawMessageHash: input.rawMessageHash,
    correlationId,
    extractedDocuments: input.extractedDocuments,
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
