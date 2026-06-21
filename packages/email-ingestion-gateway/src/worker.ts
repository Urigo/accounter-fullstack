type EmailMessageLike = {
  to: string;
  headers: Headers;
  raw: ReadableStream;
  forward: (recipient: string) => Promise<unknown>;
};

export type WorkerEnv = {
  CF_WEBHOOK_SECRET: string;
  GATEWAY_URL: string;
  FALLBACK_EMAIL?: string;
};

// Pre-computed hex lookup table. Building the hex string with a single pass and
// a lookup avoids the multiple large intermediate arrays produced by
// `Array.from(...).map(...).join('')`, which matters for large emails (e.g. with
// attachments) under the Worker's strict CPU limits.
const HEX_OCTETS = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

function hex(bytes: ArrayBuffer): string {
  const uint8 = new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < uint8.length; i++) {
    out += HEX_OCTETS[uint8[i]];
  }
  return out;
}

async function hmacSha256Hex(secret: string, payload: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, payload as unknown as BufferSource);
  return hex(signature);
}

function joinBytes(prefix: Uint8Array, body: Uint8Array): Uint8Array {
  const payload = new Uint8Array(prefix.length + body.length);
  payload.set(prefix, 0);
  payload.set(body, prefix.length);
  return payload;
}

export async function buildGatewayRequest(message: EmailMessageLike, secret: string) {
  // The gateway's webhook handler expects the raw MIME message as the request
  // body (it computes the authoritative content hash and extracts attachments
  // from it) with the message metadata carried in headers. The signature covers
  // `${timestamp}.${rawBody}`, matching the gateway verifier.
  const rawBuffer = await new Response(message.raw).arrayBuffer();
  const rawBytes = new Uint8Array(rawBuffer);

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const messageId = message.headers.get('message-id') ?? nonce;

  const prefix = new TextEncoder().encode(`${timestamp}.`);
  const signature = await hmacSha256Hex(secret, joinBytes(prefix, rawBytes));

  return {
    body: rawBytes,
    headers: {
      'Content-Type': 'message/rfc822',
      'x-cf-timestamp': String(timestamp),
      'x-cf-signature': signature,
      'x-cf-nonce': nonce,
      // Routing metadata — the body itself is the raw MIME message.
      'x-cf-recipient': message.to,
      'x-cf-message-id': messageId,
      'x-cf-received-at': new Date().toISOString(),
      'x-correlation-id': nonce,
    },
  };
}

async function isGatewayReachable(gatewayUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${gatewayUrl}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

const worker = {
  async email(message: EmailMessageLike, env: WorkerEnv): Promise<void> {
    // Reading `message.raw` disturbs the stream, after which `message.forward()`
    // can no longer be used. Probe the gateway with a lightweight health check
    // *before* consuming the stream so an unreachable gateway can still fall
    // back to forwarding the untouched message.
    if (!(await isGatewayReachable(env.GATEWAY_URL))) {
      if (env.FALLBACK_EMAIL) {
        await message.forward(env.FALLBACK_EMAIL);
        return;
      }

      throw new Error('Gateway unreachable and FALLBACK_EMAIL is not configured');
    }

    const request = await buildGatewayRequest(message, env.CF_WEBHOOK_SECRET);

    const response = await fetch(`${env.GATEWAY_URL}/webhook`, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
    });

    if (!response.ok) {
      throw new Error(`Gateway returned status ${response.status}`);
    }
  },
};

export default worker;
