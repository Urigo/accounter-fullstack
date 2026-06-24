import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { generateCorrelationId, log } from './logger.js';
import { extractFromMime, MAX_RAW_MIME_BYTES, type ExtractedDocument } from './mime-extractor.js';
import { orchestrate, type OrchestratorDeps } from './orchestrator.js';
import type { ControlSenderEvidence } from './server-client.js';
import type { AuthenticityInput, CloudflareAuthenticityVerifier } from './verifier.js';

// Inbound requests carry the raw MIME message as their body, so the cap matches
// the MIME extractor's own raw-size limit. The extractor still enforces the
// limit precisely (returning OVERSIZE_MESSAGE); this guards the read buffer.
const MAX_BODY_BYTES = MAX_RAW_MIME_BYTES;

class PayloadTooLargeError extends Error {
  override name = 'PayloadTooLargeError';
}

/** Header carrying the recipient alias the email was addressed to. */
const RECIPIENT_HEADER = 'x-cf-recipient';
/** Header carrying the upstream message identifier. */
const MESSAGE_ID_HEADER = 'x-cf-message-id';
/** Header carrying the original received-at timestamp (ISO-8601, optional). */
const RECEIVED_AT_HEADER = 'x-cf-received-at';

/**
 * Safely read a single header value. `IncomingHttpHeaders` values may be
 * `string[]` (duplicated headers, HTTP/2), so we never assume a bare string —
 * calling string methods on an array would crash the request handler.
 */
function getSingleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export interface WebhookDeps {
  verifier: Pick<CloudflareAuthenticityVerifier, 'verify'>;
  featureFlags: { v2Enabled: boolean; shadowMode: boolean };
  serverClient?: OrchestratorDeps['serverClient'];
  /** Override the gateway treatment step (default: real; tests inject a stub to avoid Chromium). */
  applyTreatment?: OrchestratorDeps['applyTreatment'];
}

export function createWebhookHandler(deps: WebhookDeps) {
  const { verifier, featureFlags, serverClient, applyTreatment } = deps;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // 1. Feature-flag gate — reject early if v2 ingestion is not enabled
    if (!featureFlags.v2Enabled) {
      writeJson(res, 503, {
        error: 'Service unavailable',
        message: 'V2 email ingestion is not enabled',
      });
      return;
    }

    // Establish a correlation ID before any I/O for structured logging.
    // Prefer the value already set on the response by requestHandler (which read it from the
    // incoming request header or generated it), so both layers share the same ID.
    const reqCorrelationId =
      (typeof res.getHeader === 'function'
        ? (res.getHeader('X-Correlation-Id') as string | undefined)
        : undefined) ??
      getSingleHeader(req.headers['x-correlation-id']) ??
      generateCorrelationId();
    res.setHeader('X-Correlation-Id', reqCorrelationId);

    // 2. Validate required authenticity headers before reading the body (cheap, fail-fast)
    const timestampStr = getSingleHeader(req.headers['x-cf-timestamp']);
    const signature = getSingleHeader(req.headers['x-cf-signature']);
    const nonce = getSingleHeader(req.headers['x-cf-nonce']);

    if (!timestampStr || !signature || !nonce) {
      writeJson(res, 400, {
        error: 'Bad request',
        details: 'Missing required headers: x-cf-timestamp, x-cf-signature, x-cf-nonce',
      });
      return;
    }

    if (!/^\d+$/.test(timestampStr)) {
      writeJson(res, 400, {
        error: 'Bad request',
        details: 'x-cf-timestamp must be a Unix epoch integer (seconds)',
      });
      return;
    }

    const timestampSeconds = parseInt(timestampStr, 10);

    // Message metadata travels in headers (the body is the raw MIME message).
    const recipientAlias = getSingleHeader(req.headers[RECIPIENT_HEADER])?.trim();
    const messageId = getSingleHeader(req.headers[MESSAGE_ID_HEADER])?.trim();
    const receivedAt = getSingleHeader(req.headers[RECEIVED_AT_HEADER])?.trim() || undefined;

    if (!recipientAlias || !messageId) {
      writeJson(res, 400, {
        error: 'Bad request',
        details: `Missing required headers: ${RECIPIENT_HEADER}, ${MESSAGE_ID_HEADER}`,
      });
      return;
    }

    // 3. Read raw body — needed before calling the verifier (signature covers the body)
    let rawBody: Buffer;
    try {
      rawBody = await readRawBody(req, MAX_BODY_BYTES);
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        writeJson(res, 413, { error: 'Payload too large' });
      } else {
        writeJson(res, 400, { error: 'Bad request', details: 'Failed to read request body' });
      }
      return;
    }

    // 4. Authenticity verification: IP allowlist + timestamp window + HMAC + nonce replay
    let sourceIp =
      getSingleHeader(req.headers['cf-connecting-ip'])?.trim() ||
      getSingleHeader(req.headers['x-forwarded-for'])?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '';
    if (sourceIp.startsWith('::ffff:')) {
      sourceIp = sourceIp.slice(7);
    }

    const input: AuthenticityInput = { rawBody, signature, timestampSeconds, nonce, sourceIp };
    const verdict = await verifier.verify(input);

    if (!verdict.valid) {
      log(
        'warn',
        'webhook authenticity check failed',
        { reason: verdict.reason },
        reqCorrelationId,
      );
      writeJson(res, 401, { error: 'Unauthorized', reason: verdict.reason });
      return;
    }

    const effectiveCorrelationId = reqCorrelationId;

    // 5. Compute the authoritative content hash and extract candidate documents
    // from the raw MIME body. The gateway — not the upstream worker — owns the
    // hash so the server can trust a value derived from the signed payload.
    const rawMessageHash = createHash('sha256').update(rawBody).digest('hex');
    const extraction = await extractFromMime(rawBody);

    // Raw attachments (with bytes) + body are handed to orchestration, which runs
    // treatment (attachment filter, body→PDF, internal-link fetch) after the
    // business is recognized, then sends the final document set to ingest.
    let attachments: ExtractedDocument[] = [];
    let body = '';
    let senderEvidence: ControlSenderEvidence | undefined;
    let subject: string | undefined;
    if (extraction.success) {
      attachments = extraction.documents;
      body = extraction.body;
      // Forward sender evidence so the server can recognize the issuing business.
      // Present even when there are no attachments (the body may still yield a
      // document during treatment).
      senderEvidence = extraction.senderEvidence;
      // Subject feeds the human-readable charge description on the server.
      subject = extraction.subject;
    } else {
      // Extraction failed (parse error or oversize). Proceed to orchestration so
      // the server records an auditable quarantine outcome; the empty document set
      // drives the server-side NO_DOCUMENTS quarantine. No trustworthy sender
      // evidence is available in this case.
      log(
        'warn',
        'webhook: MIME extraction failed',
        { reason: extraction.reason },
        effectiveCorrelationId,
      );
    }

    log(
      'info',
      'webhook accepted',
      { recipientAlias, messageId, attachmentCount: attachments.length },
      effectiveCorrelationId,
    );

    // 6. Orchestrate: control → ingest (skip when no serverClient is wired)
    if (!serverClient) {
      log(
        'warn',
        'webhook: skipped orchestration — serverClient not configured',
        {},
        effectiveCorrelationId,
      );
      writeJson(res, 202, { status: 'accepted', correlationId: effectiveCorrelationId });
      return;
    }

    const orchestrateInput = {
      recipientAlias,
      messageId,
      rawMessageHash,
      correlationId: effectiveCorrelationId,
      receivedAt,
      subject,
      senderEvidence,
      body,
      attachments,
    };

    if (featureFlags.shadowMode) {
      // Shadow mode: respond immediately and run orchestration asynchronously.
      // The legacy listener remains the authoritative handler; v2 path is shadow-validated.
      writeJson(res, 202, {
        status: 'accepted',
        correlationId: effectiveCorrelationId,
        shadow: true,
      });
      orchestrate(orchestrateInput, { serverClient, applyTreatment })
        .then(result => {
          if (result.success) {
            log(
              'info',
              'shadow:orchestration:complete',
              { outcome: result.outcome, tenantId: result.tenantId },
              effectiveCorrelationId,
            );
          } else {
            log(
              'warn',
              'shadow:orchestration:failed',
              { reason: result.reason },
              effectiveCorrelationId,
            );
          }
        })
        .catch((err: unknown) => {
          log(
            'error',
            'shadow:orchestration:error',
            { error: String(err) },
            effectiveCorrelationId,
          );
        });
      return;
    }

    // Production mode: await orchestration and include outcome in response.
    const result = await orchestrate(orchestrateInput, { serverClient, applyTreatment });

    if (result.success) {
      writeJson(res, 202, {
        status: 'accepted',
        correlationId: effectiveCorrelationId,
        outcome: result.outcome,
        ingestId: result.ingestId ?? undefined,
        existingIngestId: result.existingIngestId ?? undefined,
        auditId: result.auditId,
        reasonCode: result.reasonCode ?? undefined,
      });
    } else {
      writeJson(res, 202, {
        status: 'accepted',
        correlationId: effectiveCorrelationId,
        failed: true,
        reason: result.reason,
      });
    }
  };
}

export async function readRawBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new PayloadTooLargeError(`Request body exceeds ${maxBytes} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function writeJson(res: ServerResponse, statusCode: number, data: Record<string, unknown>): void {
  if (!res.headersSent) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}
