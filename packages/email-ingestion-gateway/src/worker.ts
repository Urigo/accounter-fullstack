type EmailMessageLike = {
  to: string;
  headers: Headers;
  raw: ReadableStream;
  forward: (recipient: string) => Promise<unknown>;
};

export type WorkerEnv = {
  CF_WEBHOOK_SECRET: string;
  GATEWAY_URL: string;
  EMAIL_FORWARD_DESTINATION: string;
  FALLBACK_EMAIL?: string;
};

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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
    // 1. Probe the gateway first (keeps the stream untouched for a clean fallback if it fails)
    if (!(await isGatewayReachable(env.GATEWAY_URL))) {
      if (env.FALLBACK_EMAIL) {
        await message.forward(env.FALLBACK_EMAIL);
        return;
      }
      throw new Error('Gateway unreachable and FALLBACK_EMAIL is not configured');
    }

    // 2. Read the raw message into memory
    const rawBuffer = await new Response(message.raw).arrayBuffer();
    const rawBytes = new Uint8Array(rawBuffer);

    // 3. Forward the email
    try {
      await message.forward(env.EMAIL_FORWARD_DESTINATION);
      console.log(`email forwarded to ${env.EMAIL_FORWARD_DESTINATION}`);
    } catch (e) {
      console.error(`Forwarding failed: ${(e as Error).message}`);
    }

    // 4. Continue with your webhook logic
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomUUID();

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
      // Gateway is reachable but rejected the request — e.g. it is disabled
      // (EMAIL_INGESTION_V2_ENABLED=0 returns 503 during rollback) or an auth
      // check failed. Forward to the legacy Gmail inbox so no email is lost
      // during rollback, and only throw when no fallback exists. This forwards
      // *after* the read on a best-effort basis — verify it forwards in the
      // Cloudflare runtime via the §6 staging smoke tests.
      if (env.FALLBACK_EMAIL) {
        await message.forward(env.FALLBACK_EMAIL);
        return;
      }
      throw new Error('Gateway returned status ' + response.status);
    }
  },
};

export default worker;
