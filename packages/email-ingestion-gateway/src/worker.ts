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

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256Hex(secret: string, payload: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, payload);
  return hex(signature);
}

function joinBytes(prefix: Uint8Array, body: Uint8Array): Uint8Array {
  const payload = new Uint8Array(prefix.length + body.length);
  payload.set(prefix, 0);
  payload.set(body, prefix.length);
  return payload;
}

export async function buildGatewayRequest(message: EmailMessageLike, secret: string) {
  const rawBuffer = await new Response(message.raw).arrayBuffer();
  const rawBytes = new Uint8Array(rawBuffer);

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const rawMessageHash = hex(await crypto.subtle.digest('SHA-256', rawBytes));

  const body = JSON.stringify({
    recipientAlias: message.to,
    messageId: message.headers.get('message-id') ?? nonce,
    rawMessageHash,
    receivedAt: new Date().toISOString(),
    correlationId: nonce,
  });
  const prefix = new TextEncoder().encode(`${timestamp}.`);
  const bodyBytes = new TextEncoder().encode(body);
  const signature = await hmacSha256Hex(secret, joinBytes(prefix, bodyBytes));

  return {
    body,
    headers: {
      'Content-Type': 'application/json',
      'x-cf-timestamp': String(timestamp),
      'x-cf-signature': signature,
      'x-cf-nonce': nonce,
    },
  };
}

const worker = {
  async email(message: EmailMessageLike, env: WorkerEnv): Promise<void> {
    const request = await buildGatewayRequest(message, env.CF_WEBHOOK_SECRET);

    try {
      const response = await fetch(`${env.GATEWAY_URL}/webhook`, {
        method: 'POST',
        headers: request.headers,
        body: request.body,
      });

      if (!response.ok) {
        throw new Error(`Gateway returned status ${response.status}`);
      }
    } catch {
      if (env.FALLBACK_EMAIL) {
        await message.forward(env.FALLBACK_EMAIL);
        return;
      }

      throw new Error('Gateway unreachable and FALLBACK_EMAIL is not configured');
    }
  },
};

export default worker;
