import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';
import { env } from '../config/env.js';
import { verifyAccessTokenWithKey, type AuthPrincipal } from './token.js';

/**
 * Default access-token verifier wired to the configured Auth0 tenant.
 *
 * The JWKS is fetched lazily and cached per JWKS URL (jose's
 * `createRemoteJWKSet` also caches keys and handles rotation), mirroring the
 * server package's auth setup.
 */

const jwksCache = new Map<string, JWTVerifyGetKey>();

function getRemoteJwks(jwksUrl: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
    jwksCache.set(jwksUrl, jwks);
  }
  return jwks;
}

/**
 * Verify an Auth0 access token using the configured issuer, audience, and
 * JWKS. Throws `TokenVerificationError` on any failure.
 */
export function verifyAccessToken(token: string): Promise<AuthPrincipal> {
  return verifyAccessTokenWithKey(token, getRemoteJwks(env.auth0.jwksUrl), {
    issuer: env.auth0.issuerUrl,
    audience: env.auth0.audience,
  });
}

/** Test-only: clear the memoized JWKS resolvers. */
export function resetJwksCache(): void {
  jwksCache.clear();
}
