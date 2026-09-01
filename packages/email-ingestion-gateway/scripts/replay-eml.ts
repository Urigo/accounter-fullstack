/**
 * Re-drive a captured `.eml` file through the full gateway pipeline — the
 * recovery step for an email that was lost or that failed before anything
 * durable was recorded (see #4344).
 *
 * `inspect-eml.ts` stops at extraction and never calls the server. This script
 * signs the raw MIME exactly as `worker.ts` does (HMAC-SHA256 over
 * `` `${timestamp}.${rawBody}` ``, hex) and POSTs it to the configured gateway,
 * so control → treatment → ingest all run for real.
 *
 *   yarn workspace @accounter/email-ingestion-gateway replay:eml path/to/message.eml
 *
 * Options:
 *   --recipient <alias>   override x-cf-recipient (default: Delivered-To / To
 *                         from the message; the alias in the headers is not
 *                         always the one that routed it)
 *   --received-at <iso>   preserve the original received-at so the charge
 *                         description keeps the real date, not the replay date
 *                         (default: the message's own Date header, else now)
 *   --gateway <url>       override the gateway base URL
 *   --message-id <id>     override x-cf-message-id
 *   --dry-run             print the request without sending it
 *
 * **Safe to re-run.** Idempotency is keyed on `rawMessageHash`, computed by the
 * gateway from these exact bytes: a genuinely lost message inserts cleanly, and
 * one that already landed comes back `DUPLICATE` rather than double-inserting.
 *
 * Requires `CF_WEBHOOK_SECRET` to match the gateway's; the script refuses to send
 * an unsigned request. Real captured messages belong in the git-ignored
 * `example-docs/`, never in a committed fixture.
 */
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { env } from '../src/environment.js';

interface Options {
  path: string;
  recipient?: string;
  receivedAt?: string;
  gateway?: string;
  messageId?: string;
  dryRun: boolean;
}

const USAGE = `Usage: replay:eml <path-to-.eml> [--recipient <alias>] [--received-at <iso>]
                 [--gateway <url>] [--message-id <id>] [--dry-run]`;

function parseArgs(argv: string[]): Options | null {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--')) {
      const value = argv[++i];
      if (value === undefined) {
        console.error(`Missing value for ${arg}`);
        return null;
      }
      flags.set(arg.slice(2), value);
    } else {
      positional.push(arg);
    }
  }

  const path = positional[0];
  if (!path) return null;

  return {
    path,
    recipient: flags.get('recipient'),
    receivedAt: flags.get('received-at'),
    gateway: flags.get('gateway'),
    messageId: flags.get('message-id'),
    dryRun,
  };
}

/**
 * Read a header out of the raw MIME without parsing the whole message: only the
 * routing metadata the Worker would have supplied is needed here, and the
 * gateway re-parses the body itself. Handles folded (continuation) lines.
 */
function readHeader(raw: string, name: string): string | undefined {
  const headerBlock = raw.split(/\r?\n\r?\n/, 1)[0] ?? '';
  const pattern = new RegExp(`^${name}:[ \\t]*(.*(?:\\r?\\n[ \\t]+.*)*)$`, 'im');
  const match = headerBlock.match(pattern);
  return match?.[1]?.replace(/\r?\n[ \t]+/g, ' ').trim() || undefined;
}

/** Pull the bare address out of a `Display Name <addr@host>` header value. */
function bareAddress(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const angled = value.match(/<([^>]+)>/);
  return (angled?.[1] ?? value.split(',')[0]).trim() || undefined;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const secret = env.cloudflare.webhookSecret;
  if (!secret) {
    console.error(
      'CF_WEBHOOK_SECRET is not set. Refusing to send an unsigned request — the gateway would ' +
        'reject it as INVALID_AUTH. Set it to the same value the gateway uses.',
    );
    process.exitCode = 1;
    return;
  }

  const gatewayUrl = (
    options.gateway ??
    process.env.GATEWAY_URL ??
    'http://localhost:3000'
  ).replace(/\/+$/, '');

  const rawBytes = await readFile(options.path);
  // Headers are ASCII; decoding latin1 keeps byte offsets intact and never throws
  // on a non-UTF-8 body. The signed payload uses the original bytes regardless.
  const rawText = rawBytes.toString('latin1');

  const recipient =
    options.recipient ??
    bareAddress(readHeader(rawText, 'Delivered-To')) ??
    bareAddress(readHeader(rawText, 'X-Original-To')) ??
    bareAddress(readHeader(rawText, 'To'));

  if (!recipient) {
    console.error(
      'Could not determine the recipient alias from Delivered-To / X-Original-To / To. ' +
        'Pass --recipient <alias>.',
    );
    process.exitCode = 1;
    return;
  }

  const messageId = options.messageId ?? readHeader(rawText, 'Message-ID') ?? randomUUID();

  const dateHeader = readHeader(rawText, 'Date');
  const parsedDate = dateHeader ? new Date(dateHeader) : undefined;
  const receivedAt =
    options.receivedAt ??
    (parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toISOString()
      : new Date().toISOString());

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = randomUUID();
  const correlationId = randomUUID();

  // Identical construction to worker.ts: HMAC-SHA256 over `${timestamp}.` followed
  // by the raw MIME bytes, hex-encoded. Fed incrementally rather than through a
  // concatenated buffer — the digest is the same, without a second copy of a
  // message that can be up to 25 MB.
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.`, 'utf8')
    .update(rawBytes)
    .digest('hex');

  const headers: Record<string, string> = {
    'Content-Type': 'message/rfc822',
    'x-cf-timestamp': String(timestamp),
    'x-cf-signature': signature,
    'x-cf-nonce': nonce,
    'x-cf-recipient': recipient,
    'x-cf-message-id': messageId,
    'x-cf-received-at': receivedAt,
    'x-correlation-id': correlationId,
  };

  console.log(`POST ${gatewayUrl}/webhook`);
  console.log(`  recipient:     ${recipient}`);
  console.log(`  messageId:     ${messageId}`);
  console.log(`  receivedAt:    ${receivedAt}`);
  console.log(`  correlationId: ${correlationId}`);
  console.log(`  body:          ${rawBytes.length} bytes`);

  if (options.dryRun) {
    console.log('\n--dry-run: not sending. Headers:');
    console.log(JSON.stringify(headers, null, 2));
    return;
  }

  const response = await fetch(`${gatewayUrl}/webhook`, {
    method: 'POST',
    headers,
    // A Buffer is already a Uint8Array, so it is a valid BodyInit as-is; wrapping
    // it copied the whole message for nothing.
    body: rawBytes,
  });

  const text = await response.text();
  console.log(`\nHTTP ${response.status}`);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }

  // A non-2xx is how the gateway tells the Cloudflare Worker to fall back, so it
  // is also how it tells an operator the replay did not land.
  if (!response.ok) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
