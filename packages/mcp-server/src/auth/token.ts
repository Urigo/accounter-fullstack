import type { IncomingMessage } from 'node:http';
import { jwtVerify, type JWTPayload, type JWTVerifyGetKey, type KeyObject } from 'jose';

/**
 * Bearer token extraction and Auth0 access-token verification.
 *
 * Tokens are only ever read from the `Authorization: Bearer <token>` header —
 * never from query params (spec §6.5). Raw token values are never logged.
 */

const BEARER_RE = /^Bearer[ ]+(.+)$/i;

/** Extract the bearer token from the Authorization header, or `null`. */
export function extractBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string') {
    return null;
  }
  const match = BEARER_RE.exec(header.trim());
  if (!match) {
    return null;
  }
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/** Authenticated caller derived from a verified access token. */
export interface AuthPrincipal {
  /** Subject claim (`sub`) — the stable user identifier. */
  subject: string;
  /** Token issuer (`iss`). */
  issuer: string;
  /** Audience claim (`aud`). */
  audience: string | string[] | undefined;
  /** Granted scopes, parsed from the `scope` string and/or `permissions`. */
  scopes: readonly string[];
  /** Email claim, when present. */
  email: string | null;
  /** Expiry as a UNIX timestamp (seconds), when present. */
  expiresAt: number | undefined;
  /** Full verified claim set for downstream identity mapping. */
  claims: JWTPayload;
}

/** Raised when an access token fails verification. Carries no token material. */
export class TokenVerificationError extends Error {
  /** RFC 6750 error code surfaced in the WWW-Authenticate challenge. */
  public readonly code = 'invalid_token';

  constructor(message: string) {
    super(message);
    this.name = 'TokenVerificationError';
  }
}

/** Parse space-delimited `scope` and array `permissions` into a scope list. */
function parseScopes(payload: JWTPayload): string[] {
  const scopes = new Set<string>();
  if (typeof payload.scope === 'string') {
    for (const scope of payload.scope.split(' ')) {
      if (scope.trim()) {
        scopes.add(scope.trim());
      }
    }
  }
  const permissions = (payload as { permissions?: unknown }).permissions;
  if (Array.isArray(permissions)) {
    for (const permission of permissions) {
      if (typeof permission === 'string' && permission.trim()) {
        scopes.add(permission.trim());
      }
    }
  }
  return [...scopes];
}

/** Map a verified JWT payload to an {@link AuthPrincipal}. */
export function toPrincipal(payload: JWTPayload): AuthPrincipal {
  if (!payload.sub) {
    throw new TokenVerificationError('token is missing the subject (sub) claim');
  }
  const email = payload['email'];
  return {
    subject: payload.sub,
    issuer: payload.iss ?? '',
    audience: payload.aud,
    scopes: parseScopes(payload),
    email: typeof email === 'string' ? email : null,
    expiresAt: payload.exp,
    claims: payload,
  };
}

export interface VerifyOptions {
  issuer: string;
  audience: string;
}

/**
 * Verify an access token against the given key (a JWKS resolver or a public
 * key), enforcing issuer, audience, signature, and expiry. Throws
 * {@link TokenVerificationError} on any failure. Pure w.r.t. process env, so it
 * is directly unit-testable with a local key.
 */
export async function verifyAccessTokenWithKey(
  token: string,
  key: JWTVerifyGetKey | KeyObject | Uint8Array,
  options: VerifyOptions,
): Promise<AuthPrincipal> {
  try {
    const verifyOptions = { issuer: options.issuer, audience: options.audience };
    // jose has separate overloads for a static key vs. a key-resolver function;
    // branch so the correct one is selected.
    const { payload } =
      typeof key === 'function'
        ? await jwtVerify(token, key, verifyOptions)
        : await jwtVerify(token, key, verifyOptions);
    return toPrincipal(payload);
  } catch (error) {
    if (error instanceof TokenVerificationError) {
      throw error;
    }
    // Normalize jose errors to a safe, token-free message.
    const reason = error instanceof Error ? error.message : 'verification failed';
    throw new TokenVerificationError(reason);
  }
}

// Associate a verified principal with its request for downstream steps.
const principalByRequest = new WeakMap<IncomingMessage, AuthPrincipal>();

export function setAuthPrincipal(req: IncomingMessage, principal: AuthPrincipal): void {
  principalByRequest.set(req, principal);
}

export function getAuthPrincipal(req: IncomingMessage): AuthPrincipal | undefined {
  return principalByRequest.get(req);
}
