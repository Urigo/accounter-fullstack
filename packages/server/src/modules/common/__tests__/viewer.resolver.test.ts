import { describe, expect, it, vi } from 'vitest';
import { AcceptInvitationsProvider } from '../../auth/providers/accept-invitations.provider.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { Auth0ManagementProvider } from '../../auth/providers/auth0-management.provider.js';
import { SuperAdminProvider } from '../../auth/providers/super-admin.provider.js';
import { viewerResolvers } from '../resolvers/viewer.resolver.js';

type AuthContextValue = Awaited<ReturnType<AuthContextProvider['getAuthContext']>>;
type JwtIdentity = Awaited<ReturnType<AuthContextProvider['getJwtIdentity']>>;

type Options = {
  superAdmin?: boolean | Error;
  pendingInvitation?: boolean | Error;
  auth0Profile?: { email: string | null; emailVerified: boolean } | null | Error;
};

async function runResolver(
  authContext: AuthContextValue,
  jwtIdentity: JwtIdentity,
  options: Options = {},
) {
  const answer = <T,>(value: T | Error) =>
    value instanceof Error ? vi.fn().mockRejectedValue(value) : vi.fn().mockResolvedValue(value);

  const authProvider = {
    getAuthContext: vi.fn().mockResolvedValue(authContext),
    getJwtIdentity: vi.fn().mockResolvedValue(jwtIdentity),
  };
  const superAdminProvider = { isSuperAdmin: answer(options.superAdmin ?? false) };
  const acceptInvitationsProvider = {
    hasPendingInvitationForEmail: answer(options.pendingInvitation ?? false),
  };
  const auth0Management = { getUserEmailById: answer(options.auth0Profile ?? null) };

  const providers = new Map<unknown, unknown>([
    [AuthContextProvider, authProvider],
    [SuperAdminProvider, superAdminProvider],
    [AcceptInvitationsProvider, acceptInvitationsProvider],
    [Auth0ManagementProvider, auth0Management],
  ]);
  const injector = {
    get: vi.fn((token: unknown) => {
      if (!providers.has(token)) {
        throw new Error(`Unexpected provider requested: ${String(token)}`);
      }
      return providers.get(token);
    }),
  };
  const resolver = viewerResolvers.Query!.viewer as unknown as (
    parent: unknown,
    args: unknown,
    context: { injector: { get: (token: unknown) => unknown } },
    info: unknown,
  ) => Promise<Record<string, unknown> | null>;

  return {
    result: await resolver(undefined, undefined, { injector }, undefined),
    authProvider,
    superAdminProvider,
    acceptInvitationsProvider,
    auth0Management,
  };
}

const linkedContext = {
  authType: 'jwt',
  user: { email: 'member@example.com', emailVerified: true, auth0UserId: 'auth0|member' },
} as unknown as AuthContextValue;

describe('viewer resolver', () => {
  it('reports ACTIVE when the identity resolves to an auth context', async () => {
    const { result, authProvider, acceptInvitationsProvider } = await runResolver(
      linkedContext,
      null,
    );

    expect(result).toEqual({
      email: 'member@example.com',
      emailVerified: true,
      status: 'ACTIVE',
      isSuperAdmin: false,
      hasPendingInvitation: false,
    });
    // An active member must not pay for a second JWT verification.
    expect(authProvider.getJwtIdentity).not.toHaveBeenCalled();
    expect(acceptInvitationsProvider.hasPendingInvitationForEmail).not.toHaveBeenCalled();
  });

  it('reports a linked super-admin', async () => {
    const { result, superAdminProvider } = await runResolver(linkedContext, null, {
      superAdmin: true,
    });

    expect(result).toMatchObject({ status: 'ACTIVE', isSuperAdmin: true });
    expect(superAdminProvider.isSuperAdmin).toHaveBeenCalledWith('auth0|member');
  });

  it('never checks super-admin status for a caller without an Auth0 subject', async () => {
    const { result, superAdminProvider } = await runResolver(
      {
        authType: 'apiKey',
        user: { email: '', emailVerified: false, auth0UserId: null },
      } as unknown as AuthContextValue,
      null,
      { superAdmin: true },
    );

    expect(result).toMatchObject({ isSuperAdmin: false });
    expect(superAdminProvider.isSuperAdmin).not.toHaveBeenCalled();
  });

  it('answers isSuperAdmin false instead of failing when the check fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = await runResolver(linkedContext, null, { superAdmin: new Error('db') });

    expect(result).toMatchObject({ status: 'ACTIVE', isSuperAdmin: false });
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
      isSuperAdmin: false,
      hasPendingInvitation: false,
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
      isSuperAdmin: false,
      hasPendingInvitation: false,
    });
  });

  it('reports a pending invitation for an unlinked caller, verified or not', async () => {
    const { result, acceptInvitationsProvider } = await runResolver(
      null,
      { auth0UserId: 'auth0|invitee', email: 'invitee@example.com', emailVerified: false },
      { pendingInvitation: true },
    );

    expect(result).toMatchObject({ status: 'EMAIL_UNVERIFIED', hasPendingInvitation: true });
    expect(acceptInvitationsProvider.hasPendingInvitationForEmail).toHaveBeenCalledWith(
      'invitee@example.com',
    );
  });

  it('answers hasPendingInvitation false instead of failing when the lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = await runResolver(
      null,
      { auth0UserId: 'auth0|invitee', email: 'invitee@example.com', emailVerified: true },
      { pendingInvitation: new Error('db') },
    );

    expect(result).toMatchObject({ status: 'NO_WORKSPACE', hasPendingInvitation: false });
  });

  it('reads the email from Auth0 when the access token carries none', async () => {
    const { result, auth0Management } = await runResolver(
      null,
      { auth0UserId: 'auth0|invitee', email: null, emailVerified: false },
      { auth0Profile: { email: 'invitee@example.com', emailVerified: true }, pendingInvitation: true },
    );

    expect(auth0Management.getUserEmailById).toHaveBeenCalledWith('auth0|invitee');
    expect(result).toEqual({
      email: 'invitee@example.com',
      emailVerified: true,
      status: 'NO_WORKSPACE',
      isSuperAdmin: false,
      hasPendingInvitation: true,
    });
  });

  it('keeps the token claims when the Auth0 lookup fails', async () => {
    const { result } = await runResolver(
      null,
      { auth0UserId: 'auth0|invitee', email: null, emailVerified: false },
      { auth0Profile: new Error('Auth0 client not initialized') },
    );

    expect(result).toMatchObject({
      email: null,
      status: 'EMAIL_UNVERIFIED',
      hasPendingInvitation: false,
    });
  });

  it('keeps a linked member ACTIVE even when their email is unverified', async () => {
    // Membership decides: the API already serves this caller's data, so routing
    // them to /welcome would lock out a working account over a claim that is not
    // enforced anywhere else.
    const { result } = await runResolver(
      {
        authType: 'jwt',
        user: { email: 'member@example.com', emailVerified: false },
      } as unknown as AuthContextValue,
      null,
    );

    expect(result).toMatchObject({ status: 'ACTIVE', emailVerified: false });
  });

  it('returns null when the request carries no valid credentials', async () => {
    const { result } = await runResolver(null, null);

    expect(result).toBeNull();
  });
});
