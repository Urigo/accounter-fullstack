import type { IncomingMessage, ServerResponse } from 'node:http';
import zod from 'zod';
import { generateCorrelationId, log } from './logger.js';
import { orchestrate, type OrchestratorDeps } from './orchestrator.js';
import type { AuthenticityInput, CloudflareAuthenticityVerifier } from './verifier.js';

const MAX_BODY_BYTES = 1_048_576; // 1 MiB

class PayloadTooLargeError extends Error {
  override name = 'PayloadTooLargeError';
}

const WebhookBodySchema = zod.object({
  recipientAlias: zod.string().min(1),
  messageId: zod.string().min(1),
  rawMessageHash: zod
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'must be a 64-character SHA-256 hex string'),
  receivedAt: zod.string().optional(),
  correlationId: zod.string().optional(),
});

export type WebhookBody = zod.infer<typeof WebhookBodySchema>;

export interface WebhookDeps {
  verifier: Pick<CloudflareAuthenticityVerifier, 'verify'>;
  featureFlags: { v2Enabled: boolean; shadowMode: boolean };
  serverClient?: OrchestratorDeps['serverClient'];
}

export function createWebhookHandler(deps: WebhookDeps) {
  const { verifier, featureFlags, serverClient } = deps;

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
      (req.headers['x-correlation-id'] as string | undefined) ??
      generateCorrelationId();
    res.setHeader('X-Correlation-Id', reqCorrelationId);

    // 2. Validate required authenticity headers before reading the body (cheap, fail-fast)
    const timestampStr = req.headers['x-cf-timestamp'] as string | undefined;
    const signature = req.headers['x-cf-signature'] as string | undefined;
    const nonce = req.headers['x-cf-nonce'] as string | undefined;

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
      (req.headers['cf-connecting-ip'] as string | undefined)?.trim() ??
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
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

    // 5. Parse and structurally validate JSON body
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody.toString('utf8'));
    } catch {
      writeJson(res, 400, { error: 'Bad request', details: 'Body must be valid JSON' });
      return;
    }

    const bodyResult = WebhookBodySchema.safeParse(parsedBody);
    if (!bodyResult.success) {
      writeJson(res, 400, {
        error: 'Bad request',
        details: bodyResult.error.issues
          .map(i => (i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message))
          .join('; '),
      });
      return;
    }

    const body = bodyResult.data;
    const effectiveCorrelationId = body.correlationId ?? reqCorrelationId;

    log(
      'info',
      'webhook accepted',
      { recipientAlias: body.recipientAlias, messageId: body.messageId },
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
      recipientAlias: body.recipientAlias,
      messageId: body.messageId,
      rawMessageHash: body.rawMessageHash,
      correlationId: effectiveCorrelationId,
      receivedAt: body.receivedAt,
      extractedDocuments: [],
    };

    if (featureFlags.shadowMode) {
      // Shadow mode: respond immediately and run orchestration asynchronously.
      // The legacy listener remains the authoritative handler; v2 path is shadow-validated.
      writeJson(res, 202, {
        status: 'accepted',
        correlationId: effectiveCorrelationId,
        shadow: true,
      });
      orchestrate(orchestrateInput, { serverClient })
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
    const result = await orchestrate(orchestrateInput, { serverClient });

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
