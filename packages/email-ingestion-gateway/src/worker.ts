type EmailMessageLike = {
  to: string;
  headers: Headers;
  raw: ReadableStream;
  /**
   * Cloudflare's `forward(rcptTo, headers?)`. The runtime keeps only `X-`-prefixed
   * headers from the second argument and drops the rest. Hand-declared because
   * `@cloudflare/workers-types` is not a dependency of this package.
   */
  forward: (recipient: string, headers?: Headers) => Promise<unknown>;
};

export type WorkerEnv = {
  CF_WEBHOOK_SECRET: string;
  GATEWAY_URL: string;
  EMAIL_FORWARD_DESTINATION: string;
  FALLBACK_EMAIL?: string;
  /**
   * Optional override for {@link DEFAULT_HEALTH_PROBE_TIMEOUT_MS}, in milliseconds.
   * The right ceiling depends on how slowly the gateway's host cold-starts, which is
   * a property of the deployment rather than of this code — so it is tunable without
   * a Worker deploy. Ignored when unset or unparseable.
   */
  HEALTH_PROBE_TIMEOUT_MS?: string;
};

const HEX_OCTETS = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/**
 * Ceiling on the health probe.
 *
 * Bounded because an unbounded probe can run past the Worker's wall-clock budget,
 * and that exception reaches Cloudflare as a temporary delivery failure — a
 * redelivery-loop source of its own.
 *
 * The value is deliberately generous. This gateway scales to zero and cold-starts
 * on *every* delivery, and the probe is what wakes it, so the probe always pays the
 * cold start. Production restarts measured 0.8-9.4 s from process start to serving
 * `/health` (median ~1.7 s), and that excludes container scheduling before the
 * process logs at all. A tight ceiling here is not a safety measure — it silently
 * converts a slow-but-healthy cold start into "unreachable", which forwards the mail
 * to the fallback mailbox and skips ingestion entirely. Prefer waiting.
 */
const DEFAULT_HEALTH_PROBE_TIMEOUT_MS = 30_000;

/** Ceiling on rejected-response text carried into the logs. */
const MAX_LOGGED_BODY_CHARS = 500;

function hex(bytes: ArrayBuffer): string {
  const uint8 = new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < uint8.length; i++) {
    out += HEX_OCTETS[uint8[i]];
  }
  return out;
}

/**
 * Case-insensitive, trimmed address compare, so a difference of case or padding in a
 * dashboard-entered variable is not mistaken for two distinct mailboxes.
 *
 * Plus-tags are deliberately NOT normalized away: `inbox+fallback@x` and `inbox@x`
 * reach the same human mailbox, but they are two distinct Email Routing destinations,
 * and forwarding to both is exactly how the fallback copy is made identifiable. If
 * this collapsed them, the fallback forward below would be skipped as a duplicate.
 */
function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Headers stamped onto every forwarded copy.
 *
 * The forwarded MIME is otherwise untouched, so its `To:` still shows the tenant
 * alias and nothing in the message names the mailbox it was routed to. These say
 * which path produced the copy and carry the correlation id, so a message in the
 * destination mailbox can be joined to the gateway logs for the same delivery.
 *
 * The runtime keeps only `X-`-prefixed headers here and drops everything else, so
 * every name below must start with `X-`.
 */
function forwardHeaders(
  path: 'archive' | 'fallback',
  correlationId: string,
  message: EmailMessageLike,
  extra: Record<string, string> = {},
): Headers {
  return new Headers({
    'X-Accounter-Forward': path,
    'X-Accounter-Correlation-Id': correlationId,
    'X-Accounter-Recipient': message.to,
    ...extra,
  });
}

/**
 * One structured line per decision. A `wrangler tail` has to say which branch fired
 * and why — reconstructing that from a bare stack trace is what made the redelivery
 * loop hard to place.
 */
function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ...fields }));
}

/** Parse the override, falling back to the default on anything not a positive number. */
function healthProbeTimeoutMs(env: WorkerEnv): number {
  const parsed = Number(env.HEALTH_PROBE_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HEALTH_PROBE_TIMEOUT_MS;
}

async function isGatewayReachable(gatewayUrl: string, timeoutMs: number): Promise<boolean> {
  try {
    const response = await fetch(`${gatewayUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const worker = {
  async email(message: EmailMessageLike, env: WorkerEnv): Promise<void> {
    // Minted before the first forward, not at the webhook call, so that every
    // forwarded copy and every log line for this delivery share one id. It doubles
    // as the replay nonce sent to the gateway.
    const correlationId = crypto.randomUUID();

    // Which variables are actually bound decides which failure path can fire, and
    // `wrangler.jsonc` declares no `vars` — these are dashboard-managed, and a
    // plain-text (non-secret) one is silently dropped by `wrangler deploy`. The
    // booleans make a misconfiguration readable from the first delivery instead of
    // inferred from a loop.
    //
    // Addresses are deliberately absent from every `worker:*` line: the recipient
    // alias is tenant-identifying and the destinations are real mailboxes, and
    // neither adds diagnostic power over the booleans here — the gateway already
    // records `recipientAlias` against the same correlation id. The one place an
    // address can still surface is a runtime error string we pass through verbatim
    // (`worker:forward_failed`), where the text is the diagnosis.
    logEvent('worker:email:start', {
      messageId: message.headers.get('message-id'),
      correlationId,
      gatewayUrlConfigured: !!env.GATEWAY_URL,
      forwardDestinationConfigured: !!env.EMAIL_FORWARD_DESTINATION,
      fallbackEmailConfigured: !!env.FALLBACK_EMAIL,
      fallbackEqualsForwardDestination: sameAddress(
        env.FALLBACK_EMAIL,
        env.EMAIL_FORWARD_DESTINATION,
      ),
    });

    // 1. Probe the gateway first (keeps the stream untouched for a clean fallback if it fails)
    if (!(await isGatewayReachable(env.GATEWAY_URL, healthProbeTimeoutMs(env)))) {
      logEvent('worker:gateway_unreachable', { fallbackEmailConfigured: !!env.FALLBACK_EMAIL });
      if (env.FALLBACK_EMAIL) {
        await message.forward(
          env.FALLBACK_EMAIL,
          forwardHeaders('fallback', correlationId, message, {
            'X-Accounter-Fallback-Reason': 'gateway-unreachable',
          }),
        );
        return;
      }
      // Nothing has been forwarded yet, so the message exists only upstream: a
      // Cloudflare redelivery is the correct no-loss behaviour here, and a gateway
      // outage is genuinely the kind of failure that clears.
      throw new Error('Gateway unreachable and FALLBACK_EMAIL is not configured');
    }

    // 2. Read the raw message into memory
    const rawBuffer = await new Response(message.raw).arrayBuffer();
    const rawBytes = new Uint8Array(rawBuffer);

    // 3. Forward the email. Whether this succeeded is what decides, further down,
    //    whether a gateway rejection may be escalated into a delivery failure.
    let forwardedToDestination = false;
    let forwardedToFallback = false;
    try {
      await message.forward(
        env.EMAIL_FORWARD_DESTINATION,
        forwardHeaders('archive', correlationId, message),
      );
      forwardedToDestination = true;
      logEvent('worker:forwarded');
    } catch (e) {
      logEvent('worker:forward_failed', {
        configured: !!env.EMAIL_FORWARD_DESTINATION,
        error: (e as Error).message,
      });
    }

    // 4. Continue with your webhook logic
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = correlationId;

    // Compute HMAC-SHA256 over `${timestamp}.${rawBody}`, where rawBody is the
    // raw MIME message — the exact bytes sent as the request body. The gateway
    // verifies the signature over the body it receives, then parses the MIME,
    // extracts attachments, and computes the SHA-256 content hash itself. The
    // worker therefore only forwards the message plus routing metadata (in
    // headers); no hash is sent.
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.CF_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const prefix = new TextEncoder().encode(timestamp + '.');
    const payload = new Uint8Array(prefix.length + rawBytes.length);
    payload.set(prefix, 0);
    payload.set(rawBytes, prefix.length);
    const signature = hex(await crypto.subtle.sign('HMAC', key, payload));

    const response = await fetch(`${env.GATEWAY_URL}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'message/rfc822',
        'x-cf-timestamp': String(timestamp),
        'x-cf-signature': signature,
        'x-cf-nonce': nonce,
        // Routing metadata — the body itself is the raw MIME message.
        'x-cf-recipient': message.to,
        'x-cf-message-id': message.headers.get('message-id') ?? nonce,
        'x-cf-received-at': new Date().toISOString(),
        'x-correlation-id': nonce,
      },
      // Send the raw MIME bytes as the request body.
      body: rawBytes,
    });

    if (!response.ok) {
      // The gateway is reachable but refused: it is disabled
      // (EMAIL_INGESTION_V2_ENABLED=0 returns 503 during rollback), an auth check
      // failed, or orchestration failed leaving no durable record server-side
      // (503; see `statusForOrchestrationFailure` in webhook.ts).
      //
      // **Never throw from here.** Cloudflare Email Routing treats an unhandled
      // exception as a temporary delivery failure and redelivers with growing
      // backoff. A retry only helps if the gateway will answer differently later,
      // and a permanent rejection never will — a 400 from input-shape drift put
      // three messages through 4-5 redeliveries across 12 hours that way. Step 3
      // has already delivered the message, so a rejection here is a lost
      // *ingestion*, not a lost *email*, and must not be escalated.
      const detail = await response.text().catch(() => '');
      logEvent('worker:gateway_rejected', {
        status: response.status,
        // The gateway answers with { failed, reason, correlationId }; carrying it
        // here is what joins a Worker tail to the gateway's own logs.
        body: detail.slice(0, MAX_LOGGED_BODY_CHARS),
        forwardedToDestination,
      });

      if (!env.FALLBACK_EMAIL) {
        logEvent('worker:fallback_skipped', {
          cause: 'FALLBACK_EMAIL_NOT_CONFIGURED',
          forwardedToDestination,
        });
      } else if (sameAddress(env.FALLBACK_EMAIL, env.EMAIL_FORWARD_DESTINATION)) {
        // Both forwards would land in the same mailbox, so the second copy adds
        // nothing over the one step 3 already sent. (Cloudflare does not document
        // whether a repeat forward to the same address errors or is accepted;
        // skipping is correct either way and keeps the outcome idempotent.)
        logEvent('worker:fallback_skipped', {
          cause: 'FALLBACK_EQUALS_FORWARD_DESTINATION',
          forwardedToDestination,
        });
      } else {
        try {
          await message.forward(
            env.FALLBACK_EMAIL,
            forwardHeaders('fallback', correlationId, message, {
              'X-Accounter-Fallback-Reason': 'gateway-rejected',
              'X-Accounter-Gateway-Status': String(response.status),
            }),
          );
          forwardedToFallback = true;
          logEvent('worker:fallback_forwarded');
        } catch (e) {
          logEvent('worker:fallback_forward_failed', {
            error: (e as Error).message,
            forwardedToDestination,
          });
        }
      }

      if (!forwardedToDestination && !forwardedToFallback) {
        // The one genuine total-loss case: no copy reached a human, and control
        // never granted so nothing was recorded server-side either. This is the
        // only situation where a redelivery is worth the loop risk — and the
        // `worker:forward_failed` / `worker:fallback_skipped` /
        // `worker:fallback_forward_failed` lines above name the misconfiguration
        // that has to be fixed for it to stop.
        throw new Error(
          `Gateway returned status ${response.status} and no copy of the message was delivered`,
        );
      }
      return;
    }

    logEvent('worker:gateway_accepted', { status: response.status });
  },
};

export default worker;
