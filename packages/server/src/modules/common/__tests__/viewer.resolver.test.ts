import { describe, expect, it, vi } from 'vitest';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { PendingInvitationsProvider } from '../../auth/providers/pending-invitations.provider.js';
import { viewerResolvers } from '../resolvers/viewer.resolver.js';

type AuthContextValue = Awaited<ReturnType<AuthContextProvider['getAuthContext']>>;
type JwtIdentity = Awaited<ReturnType<AuthContextProvider['getJwtIdentity']>>;
type PendingInvitation = Awaited<
  ReturnType<PendingInvitationsProvider['getPendingInvitationsByVerifiedEmail']>
>[number];

async function runResolver(
  authContext: AuthContextValue,
  jwtIdentity: JwtIdentity,
  pendingInvitations: PendingInvitation[] = [],
) {
  const authProvider = {
    getAuthContext: vi.fn().mockResolvedValue(authContext),
    getJwtIdentity: vi.fn().mockResolvedValue(jwtIdentity),
  };
  const pendingInvitationsProvider = {
    getPendingInvitationsByVerifiedEmail: vi.fn().mockResolvedValue(pendingInvitations),
  };
  const injector = {
    get: vi.fn((token: unknown) =>
      token === PendingInvitationsProvider ? pendingInvitationsProvider : authProvider,
    ),
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
    pendingInvitationsProvider,
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
      pendingInvitations: [],
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
      pendingInvitations: [],
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
      pendingInvitations: [],
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

  it('lists invitations waiting for a verified email', async () => {
    const invitation = {
      id: 'inv-1',
      businessId: 'biz-1',
      businessName: 'Acme Ltd',
      role: 'employee',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    };

    const { result, pendingInvitationsProvider } = await runResolver(
      null,
      { auth0UserId: 'auth0|new-user', email: 'New@Example.com', emailVerified: true },
      [invitation],
    );

    expect(pendingInvitationsProvider.getPendingInvitationsByVerifiedEmail).toHaveBeenCalledWith(
      'New@Example.com',
    );
    expect(result).toMatchObject({ status: 'NO_WORKSPACE', pendingInvitations: [invitation] });
  });

  it('never matches invitations against an unverified email', async () => {
    // The address is unproven, so matching on it would hand a victim's pending
    // invitation to whoever signed up with their address first.
    const { result, pendingInvitationsProvider } = await runResolver(
      null,
      { auth0UserId: 'auth0|impostor', email: 'victim@example.com', emailVerified: false },
      [
        {
          id: 'inv-1',
          businessId: 'biz-1',
          businessName: 'Acme Ltd',
          role: 'employee',
          expiresAt: new Date('2030-01-01T00:00:00Z'),
        },
      ],
    );

    expect(pendingInvitationsProvider.getPendingInvitationsByVerifiedEmail).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'EMAIL_UNVERIFIED', pendingInvitations: [] });
  });

  it('returns null when the request carries no valid credentials', async () => {
    const { result } = await runResolver(null, null);

    expect(result).toBeNull();
  });
});
