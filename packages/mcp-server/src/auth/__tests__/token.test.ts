import type { IncomingMessage } from 'node:http';
import { generateKeyPair, type JWTVerifyGetKey, type KeyObject, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  extractBearerToken,
  toPrincipal,
  TokenVerificationError,
  verifyAccessTokenWithKey,
} from '../token.js';

const ISSUER = 'https://tenant.auth0.com/';
const AUDIENCE = 'https://api.accounter.example';

function req(headers: Record<string, string> = {}): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

describe('extractBearerToken', () => {
  it('extracts the token from a well-formed header (case-insensitive)', () => {
    expect(extractBearerToken(req({ authorization: 'Bearer abc.def.ghi' }))).toBe('abc.def.ghi');
    expect(extractBearerToken(req({ authorization: 'bearer abc' }))).toBe('abc');
  });

  it('returns null when absent, empty, or non-bearer', () => {
    expect(extractBearerToken(req())).toBeNull();
    expect(extractBearerToken(req({ authorization: 'Bearer ' }))).toBeNull();
    expect(extractBearerToken(req({ authorization: 'Basic xyz' }))).toBeNull();
  });
});

describe('toPrincipal', () => {
  it('parses subject, email, and scopes from scope + permissions', () => {
    const principal = toPrincipal({
      sub: 'user-1',
      iss: ISSUER,
      aud: AUDIENCE,
      email: 'a@b.com',
      scope: 'read:charges read:tags',
      permissions: ['read:reports', 'read:charges'],
      exp: 123,
    });
    expect(principal.subject).toBe('user-1');
    expect(principal.email).toBe('a@b.com');
    expect(principal.expiresAt).toBe(123);
    expect([...principal.scopes].sort()).toEqual(['read:charges', 'read:reports', 'read:tags']);
  });

  it('throws when the subject claim is missing', () => {
    expect(() => toPrincipal({ iss: ISSUER })).toThrow(TokenVerificationError);
  });
});

describe('verifyAccessTokenWithKey', () => {
  let publicKey: KeyObject;
  let privateKey: KeyObject;

  beforeAll(async () => {
    ({ publicKey, privateKey } = (await generateKeyPair('RS256')) as {
      publicKey: KeyObject;
      privateKey: KeyObject;
    });
  });

  async function sign(overrides: {
    issuer?: string;
    audience?: string;
    expiresIn?: string | number;
    subject?: string;
  }): Promise<string> {
    return new SignJWT({ scope: 'read:charges', email: 'a@b.com' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(overrides.issuer ?? ISSUER)
      .setAudience(overrides.audience ?? AUDIENCE)
      .setSubject(overrides.subject ?? 'user-1')
      .setIssuedAt()
      .setExpirationTime(overrides.expiresIn ?? '2h')
      .sign(privateKey);
  }

  it('accepts a valid token and returns a principal', async () => {
    const token = await sign({});
    const principal = await verifyAccessTokenWithKey(token, publicKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    expect(principal.subject).toBe('user-1');
    expect(principal.scopes).toContain('read:charges');
  });

  it('rejects a token with the wrong issuer', async () => {
    const token = await sign({ issuer: 'https://evil.example/' });
    await expect(
      verifyAccessTokenWithKey(token, publicKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('rejects a token with the wrong audience', async () => {
    const token = await sign({ audience: 'https://other.audience' });
    await expect(
      verifyAccessTokenWithKey(token, publicKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('rejects an expired token', async () => {
    const token = await sign({ expiresIn: Math.floor(Date.now() / 1000) - 60 });
    await expect(
      verifyAccessTokenWithKey(token, publicKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('rejects a token signed by a different key', async () => {
    const other = (await generateKeyPair('RS256')) as { privateKey: KeyObject };
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject('user-1')
      .setExpirationTime('2h')
      .sign(other.privateKey);
    await expect(
      verifyAccessTokenWithKey(token, publicKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('propagates infrastructure errors (e.g. JWKS timeout) instead of masking them as invalid', async () => {
    const token = await sign({});
    const infra = Object.assign(new Error('jwks unreachable'), { code: 'ERR_JWKS_TIMEOUT' });
    const getKey: JWTVerifyGetKey = () => {
      throw infra;
    };
    await expect(
      verifyAccessTokenWithKey(token, getKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toBe(infra);
  });
});
