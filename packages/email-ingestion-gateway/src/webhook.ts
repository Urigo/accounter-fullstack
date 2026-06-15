import type { IncomingMessage, ServerResponse } from 'node:http';
import zod from 'zod';
import { generateCorrelationId, log } from './logger.js';
import type { AuthenticityInput, CloudflareAuthenticityVerifier } from './verifier.js';

const MAX_BODY_BYTES = 1_048_576; // 1 MiB

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
  featureFlags: { v2Enabled: boolean };
}

export function createWebhookHandler(deps: WebhookDeps) {
  const { verifier, featureFlags } = deps;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // 1. Feature-flag gate — reject early if v2 ingestion is not enabled
    if (!featureFlags.v2Enabled) {
      writeJson(res, 503, {
        error: 'Service unavailable',
        message: 'V2 email ingestion is not enabled',
      });
      return;
    }

    // Establish a correlation ID before any I/O for structured logging
    const reqCorrelationId =
      (req.headers['x-correlation-id'] as string | undefined) ?? generateCorrelationId();
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
    } catch {
      writeJson(res, 413, { error: 'Payload too large' });
      return;
    }

    // 4. Authenticity verification: IP allowlist + timestamp window + HMAC + nonce replay
    const sourceIp =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      '';

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
        details: bodyResult.error.issues.map(i => i.message).join('; '),
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

    // 6. Return structured acceptance — orchestration (control → ingest) is wired in S18
    writeJson(res, 202, { status: 'accepted', correlationId: effectiveCorrelationId });
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
        reject(new Error(`Request body exceeds ${maxBytes} bytes`));
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
