import { describe, expect, it, vi } from 'vitest';
import { GreenInvoiceTokenCache, isUnauthorizedError } from '../access-token.js';
import { createGreenInvoiceSdk } from '../mesh-client.js';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN_PATH = '/idp/v1/oauth/token';
const HOUR_MS = 60 * 60 * 1000;
const START = Date.UTC(2026, 10, 11, 8, 0, 0);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** A JWT-shaped token (unsigned) whose `exp` claim is `expiresAt` */
function jwt(name: string, expiresAt: number) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode({ sub: name, exp: Math.floor(expiresAt / 1000) })}.sig`;
}

/**
 * Stands in for the Green Invoice token endpoint and API. Each token request issues a new one-hour
 * token (`token-1`, `token-2`, ...); `rejectedTokens` makes the API answer 401 to those tokens.
 */
function createUpstream(clock: { now: number }) {
  const tokenRequests: Array<{ client_id: string; client_secret: string }> = [];
  const apiRequests: Array<{ url: string; authorization: string | null }> = [];
  const rejectedTokens = new Set<string>();
  let tokenStatus = 200;

  const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
    const { pathname } = new URL(url);
    if (pathname === TOKEN_PATH) {
      tokenRequests.push(JSON.parse(init.body as string));
      if (tokenStatus !== 200) {
        return jsonResponse({ error: 'unavailable' }, tokenStatus);
      }
      const accessToken = jwt(`token-${tokenRequests.length}`, clock.now + HOUR_MS);
      return jsonResponse({ accessToken });
    }

    const authorization = new Headers(init.headers).get('authorization');
    apiRequests.push({ url: decodeURIComponent(url), authorization });
    if (authorization && rejectedTokens.has(authorization.replace('Bearer ', ''))) {
      return jsonResponse({ errorCode: 401, errorMessage: 'Unauthorized' }, 401);
    }
    if (pathname === `/api/v1/clients/${CLIENT_ID}`) {
      return jsonResponse({ id: CLIENT_ID, name: 'ACME', country: 'IL' });
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  });

  return {
    fetchFn: fetchFn as unknown as typeof fetch,
    tokenRequests,
    apiRequests,
    rejectedTokens,
    /** The token issued by the n-th token request (1-based) */
    issuedToken: (n: number) => jwt(`token-${n}`, START + HOUR_MS),
    setTokenStatus: (status: number) => {
      tokenStatus = status;
    },
  };
}

function setup() {
  const clock = { now: START };
  const upstream = createUpstream(clock);
  const tokenCache = new GreenInvoiceTokenCache({
    fetch: upstream.fetchFn,
    now: () => clock.now,
  });
  const createSdk = (id = 'key-id', secret = 'key-secret') =>
    createGreenInvoiceSdk({ id, secret, tokenCache, fetch: upstream.fetchFn });
  return { clock, upstream, tokenCache, createSdk };
}

describe('GreenInvoiceTokenCache', () => {
  it('makes a single token request for two operations within an hour', async () => {
    const { clock, upstream, createSdk } = setup();

    // two operations, each with its own SDK (as two GraphQL operations on the server get)
    await createSdk().getClient_query({ id: CLIENT_ID });
    clock.now += 50 * 60 * 1000;
    await createSdk().getClient_query({ id: CLIENT_ID });

    expect(upstream.tokenRequests).toEqual([
      { grant_type: 'client_credentials', client_id: 'key-id', client_secret: 'key-secret' },
    ]);
    expect(upstream.apiRequests.map(request => request.authorization)).toEqual([
      `Bearer ${upstream.issuedToken(1)}`,
      `Bearer ${upstream.issuedToken(1)}`,
    ]);
  });

  it('shares one token request between concurrent callers', async () => {
    const { upstream, tokenCache, createSdk } = setup();

    const tokens = await Promise.all([
      tokenCache.getToken('key-id', 'key-secret'),
      tokenCache.getToken('key-id', 'key-secret'),
      createSdk().getClient_query({ id: CLIENT_ID }),
    ]);

    expect(upstream.tokenRequests).toHaveLength(1);
    expect(tokens[0]).toBe(tokens[1]);
  });

  it('refreshes the token 5 minutes before it expires', async () => {
    const { clock, upstream, tokenCache } = setup();

    await tokenCache.getToken('key-id', 'key-secret');
    clock.now = START + HOUR_MS - 5 * 60 * 1000 - 1;
    await tokenCache.getToken('key-id', 'key-secret');
    expect(upstream.tokenRequests).toHaveLength(1);

    clock.now += 1;
    await tokenCache.getToken('key-id', 'key-secret');
    expect(upstream.tokenRequests).toHaveLength(2);
  });

  it('keeps separate tokens per API key and refreshes when the secret changes', async () => {
    const { upstream, tokenCache } = setup();

    const a = await tokenCache.getToken('key-a', 'secret-a');
    const b = await tokenCache.getToken('key-b', 'secret-b');
    expect(a).not.toBe(b);
    expect(await tokenCache.getToken('key-a', 'secret-a')).toBe(a);
    expect(upstream.tokenRequests).toHaveLength(2);

    const rotated = await tokenCache.getToken('key-a', 'secret-a2');
    expect(rotated).not.toBe(a);
    expect(upstream.tokenRequests.at(-1)).toMatchObject({
      client_id: 'key-a',
      client_secret: 'secret-a2',
    });
  });

  it('does not cache a failed token request', async () => {
    const { upstream, tokenCache } = setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    upstream.setTokenStatus(503);
    await expect(tokenCache.getToken('key-id', 'key-secret')).rejects.toThrow(
      'Failed to obtain access token',
    );

    upstream.setTokenStatus(200);
    await expect(tokenCache.getToken('key-id', 'key-secret')).resolves.toBeTruthy();
    expect(upstream.tokenRequests).toHaveLength(2);
  });

  it('falls back to a one-hour lifetime when the token is not a JWT', async () => {
    const clock = { now: START };
    let tokenRequests = 0;
    const fetchFn = (async () => {
      tokenRequests += 1;
      return jsonResponse({ accessToken: `opaque-${tokenRequests}` });
    }) as unknown as typeof fetch;
    const tokenCache = new GreenInvoiceTokenCache({ fetch: fetchFn, now: () => clock.now });

    expect(await tokenCache.getToken('key-id', 'key-secret')).toBe('opaque-1');
    clock.now += 54 * 60 * 1000;
    expect(await tokenCache.getToken('key-id', 'key-secret')).toBe('opaque-1');
    clock.now += 2 * 60 * 1000;
    expect(await tokenCache.getToken('key-id', 'key-secret')).toBe('opaque-2');
  });

  it('only invalidates the token that was rejected', async () => {
    const { upstream, tokenCache } = setup();

    const first = await tokenCache.getToken('key-id', 'key-secret');
    tokenCache.invalidate('key-id', first);
    const second = await tokenCache.getToken('key-id', 'key-secret');
    expect(second).not.toBe(first);

    // a late 401 for the first token leaves the second one cached
    tokenCache.invalidate('key-id', first);
    expect(await tokenCache.getToken('key-id', 'key-secret')).toBe(second);
    expect(upstream.tokenRequests).toHaveLength(2);
  });
});

describe('createGreenInvoiceSdk', () => {
  it('replaces a rejected token and retries the call once', async () => {
    const { upstream, createSdk } = setup();
    const sdk = createSdk();

    await sdk.getClient_query({ id: CLIENT_ID });
    upstream.rejectedTokens.add(upstream.issuedToken(1));

    const { getClient } = await sdk.getClient_query({ id: CLIENT_ID });

    expect(getClient).toMatchObject({ id: CLIENT_ID, name: 'ACME' });
    expect(upstream.tokenRequests).toHaveLength(2);
    expect(upstream.apiRequests.map(request => request.authorization)).toEqual([
      `Bearer ${upstream.issuedToken(1)}`,
      `Bearer ${upstream.issuedToken(1)}`,
      `Bearer ${upstream.issuedToken(2)}`,
    ]);
  });

  it('gives up after one retry', async () => {
    const { upstream, createSdk } = setup();
    upstream.rejectedTokens.add(upstream.issuedToken(1));
    upstream.rejectedTokens.add(upstream.issuedToken(2));

    const error = await createSdk()
      .getClient_query({ id: CLIENT_ID })
      .catch((e: unknown) => e);

    expect(isUnauthorizedError(error)).toBe(true);
    expect(upstream.tokenRequests).toHaveLength(2);
    expect(upstream.apiRequests).toHaveLength(2);
  });
});
