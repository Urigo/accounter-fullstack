import { describe, expect, it, vi } from 'vitest';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { viewerResolvers } from '../resolvers/viewer.resolver.js';

type AuthContextValue = Awaited<ReturnType<AuthContextProvider['getAuthContext']>>;
type JwtIdentity = Awaited<ReturnType<AuthContextProvider['getJwtIdentity']>>;

async function runResolver(authContext: AuthContextValue, jwtIdentity: JwtIdentity) {
  const authProvider = {
    getAuthContext: vi.fn().mockResolvedValue(authContext),
    getJwtIdentity: vi.fn().mockResolvedValue(jwtIdentity),
  };
  const injector = { get: vi.fn(() => authProvider) };
  const resolver = viewerResolvers.Query!.viewer as unknown as (
    parent: unknown,
    args: unknown,
    context: { injector: { get: (token: unknown) => unknown } },
    info: unknown,
  ) => Promise<Record<string, unknown> | null>;

  return {
    result: await resolver(undefined, undefined, { injector }, undefined),
    authProvider,
  };
}

const linkedContext = {
  authType: 'jwt',
  user: { email: 'member@example.com', emailVerified: true },
} as unknown as AuthContextValue;

describe('viewer resolver', () => {
  it('reports ACTIVE when the identity resolves to an auth context', async () => {
    const { result, authProvider } = await runResolver(linkedContext, null);

    expect(result).toEqual({
      email: 'member@example.com',
      emailVerified: true,
      status: 'ACTIVE',
    });
    // An active member must not pay for a second JWT verification.
    expect(authProvider.getJwtIdentity).not.toHaveBeenCalled();
  });

  it('reports NO_WORKSPACE for a verified identity with no membership', async () => {
    const { result } = await runResolver(null, {
      auth0UserId: 'auth0|new-user',
      email: 'new@example.com',
      emailVerified: true,
    });

    expect(result).toEqual({
      email: 'new@example.com',
      emailVerified: true,
      status: 'NO_WORKSPACE',
    });
  });

  it('reports EMAIL_UNVERIFIED before the email is verified', async () => {
    const { result } = await runResolver(null, {
      auth0UserId: 'auth0|new-user',
      email: 'new@example.com',
      emailVerified: false,
    });

    expect(result).toEqual({
      email: 'new@example.com',
      emailVerified: false,
      status: 'EMAIL_UNVERIFIED',
    });
  });

  it('returns null when the request carries no valid credentials', async () => {
    const { result } = await runResolver(null, null);

    expect(result).toBeNull();
  });
});
