import { createHash } from 'node:crypto';

const TOKEN_URL = 'https://api.morning.co/idp/v1/oauth/token';

/** Used when the token response doesn't say when the token expires (tokens are valid for an hour) */
const DEFAULT_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

/** A cached token is refreshed this long before it expires */
const DEFAULT_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export type AccessToken = {
  accessToken: string;
  /** Expiry time, in milliseconds since the epoch */
  expiresAt: number;
};

/** Reads the `exp` claim (seconds since the epoch) of a JWT, without verifying it */
function getJwtExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof claims?.exp === 'number' ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Picks the token's expiry: its JWT `exp` claim, else the response's expiry fields, else one hour */
function getExpiresAt(data: Record<string, unknown>, accessToken: string, now: number): number {
  const fromJwt = getJwtExpiry(accessToken);
  if (fromJwt) {
    return fromJwt;
  }
  if (typeof data['expiresIn'] === 'number') {
    // seconds from now
    return now + data['expiresIn'] * 1000;
  }
  if (typeof data['expires'] === 'number') {
    // seconds since the epoch
    return data['expires'] * 1000;
  }
  return now + DEFAULT_TOKEN_LIFETIME_MS;
}

/** Requests a new access token for the given API key */
export async function obtainAccessToken(
  id: string,
  secret: string,
  fetchFn: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<AccessToken> {
  try {
    const authParams = {
      grant_type: 'client_credentials',
      client_id: id,
      client_secret: secret,
    };
    const res = await fetchFn(TOKEN_URL, {
      method: 'POST',
      body: JSON.stringify(authParams),
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status !== 200) {
      throw new Error(
        `Failed to obtain access token, status code: ${res.status}, response: ${await res.text()}`,
      );
    }

    const data = (await res.json()) as Record<string, unknown>;
    const accessToken = data['accessToken'];
    if (typeof accessToken !== 'string' || !accessToken) {
      throw new Error('Token response has no access token');
    }

    return { accessToken, expiresAt: getExpiresAt(data, accessToken, now()) };
  } catch (e) {
    console.error('Failed to obtain access token', e);
    throw new Error('Failed to obtain access token', { cause: e });
  }
}

export type GreenInvoiceTokenCacheOptions = {
  /** Replaces the HTTP client for token requests, e.g. to run tests offline */
  fetch?: typeof fetch;
  /** Clock, in milliseconds since the epoch */
  now?: () => number;
  /** How long before expiry a cached token stops being reused. Defaults to 5 minutes. */
  refreshMarginMs?: number;
};

/** Supplies access tokens per API key; `GreenInvoiceTokenCache` is the standard implementation */
export interface GreenInvoiceTokenSource {
  getToken(id: string, secret: string, options?: GetTokenOptions): Promise<string>;
  /**
   * Called with a token the API rejected (HTTP 401), before asking for a new one; called without a
   * token when the API key itself was removed or replaced
   */
  invalidate(id: string, token?: string): void;
  /** Advances whenever a key is evicted entirely; see {@link GetTokenOptions.epoch} */
  readonly epoch?: number;
}

export type GetTokenOptions = {
  /**
   * The cache's `epoch` as observed before the caller read the credentials it passes. If a key was
   * evicted since, the credentials may have been removed or replaced in the meantime, so the token is
   * requested without reading or writing the cache: a removed key can't put its token back.
   */
  epoch?: number;
};

/** Entries hold a hash of the secret, only to notice a rotated secret, never the secret itself */
type CacheEntry = AccessToken & { secretHash: string };

/** One-way digest of a secret, used to compare secrets without keeping them in memory */
function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/**
 * Caches access tokens per API key ID, to share across requests. A token is reused until shortly
 * before it expires; concurrent callers that need a new token share a single token request.
 */
export class GreenInvoiceTokenCache implements GreenInvoiceTokenSource {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<
    string,
    { secretHash: string; promise: Promise<CacheEntry> }
  >();
  private readonly fetchFn: typeof fetch | undefined;
  private readonly now: () => number;
  private readonly refreshMarginMs: number;
  private evictions = 0;

  constructor(options: GreenInvoiceTokenCacheOptions = {}) {
    this.fetchFn = options.fetch;
    this.now = options.now ?? Date.now;
    this.refreshMarginMs = options.refreshMarginMs ?? DEFAULT_REFRESH_MARGIN_MS;
  }

  /** Advances whenever a key is evicted entirely (`invalidate` without a token) */
  public get epoch(): number {
    return this.evictions;
  }

  /**
   * Returns a token for the API key: the cached one while it is valid for longer than the refresh
   * margin and was issued for the same secret, otherwise a new one (shared with concurrent callers).
   * With a stale `options.epoch`, a new token that bypasses the cache.
   */
  public async getToken(id: string, secret: string, options?: GetTokenOptions): Promise<string> {
    if (options?.epoch !== undefined && options.epoch < this.evictions) {
      const { accessToken } = await obtainAccessToken(id, secret, this.fetchFn, this.now);
      return accessToken;
    }

    const secretHash = hashSecret(secret);
    const entry = this.entries.get(id);
    if (
      entry &&
      entry.secretHash === secretHash &&
      this.now() < entry.expiresAt - this.refreshMarginMs
    ) {
      return entry.accessToken;
    }

    let request = this.inFlight.get(id);
    if (!request || request.secretHash !== secretHash) {
      this.dropExpired();
      const promise = obtainAccessToken(id, secret, this.fetchFn, this.now)
        .then(token => {
          const newEntry = { ...token, secretHash };
          // only the current request may store its token: one for older credentials, or one whose
          // key was invalidated while it was in flight, must not (re)populate the cache
          if (this.inFlight.get(id)?.promise === promise) {
            this.entries.set(id, newEntry);
          }
          return newEntry;
        })
        .finally(() => {
          if (this.inFlight.get(id)?.promise === promise) {
            this.inFlight.delete(id);
          }
        });
      request = { secretHash, promise };
      this.inFlight.set(id, request);
    }

    return (await request.promise).accessToken;
  }

  /**
   * Drops the cached token for an API key ID. With `token` (the API rejected it), the entry is
   * dropped only if it still holds that token, so a rejection of an old token doesn't discard one
   * that was refreshed in the meantime. Without `token` (the key was removed or replaced), the key is
   * evicted entirely, and a token request already in flight for it won't be cached either; the
   * `epoch` advances, so callers holding credentials read before now stop using the cache.
   */
  public invalidate(id: string, token?: string): void {
    if (token === undefined) {
      this.entries.delete(id);
      this.inFlight.delete(id);
      this.evictions += 1;
      return;
    }
    if (this.entries.get(id)?.accessToken === token) {
      this.entries.delete(id);
    }
  }

  public clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }

  /** Drops expired entries, so keys that are no longer used don't stay cached */
  private dropExpired(): void {
    const now = this.now();
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(id);
      }
    }
  }
}

/** The upstream HTTP status of an SDK error, as `@graphql-mesh/transport-rest` reports it */
function getResponseStatus(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const extensions = (error as { extensions?: { response?: { status?: unknown } } }).extensions;
  return extensions?.response?.status;
}

/** Whether an SDK call failed because the upstream API rejected the access token (HTTP 401) */
export function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof AggregateError) {
    return error.errors.some(isUnauthorizedError);
  }
  return getResponseStatus(error) === 401;
}
