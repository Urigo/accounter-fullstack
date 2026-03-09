import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationProvider } from '../authorization.provider.js';
import type { AuthContextProvider } from '../auth-context.provider.js';
import type { AuthUser } from '../../../../shared/types/auth.js';

describe('AuthorizationProvider', () => {
  let service: AuthorizationProvider;
  let mockAuthProvider: Pick<AuthContextProvider, 'getAuthContext'>;

  const businessOwnerUser: AuthUser = {
    userId: 'user-1',
    email: 'owner@example.com',
    roleId: 'business_owner',
    permissions: [],
    emailVerified: true,
    permissionsVersion: 1,
    auth0UserId: 'auth0|owner',
  };

  const accountantUser: AuthUser = {
    ...businessOwnerUser,
    userId: 'user-2',
    email: 'accountant@example.com',
    roleId: 'accountant',
    auth0UserId: 'auth0|accountant',
  };

  const employeeUser: AuthUser = {
    ...businessOwnerUser,
    userId: 'user-3',
    email: 'employee@example.com',
    roleId: 'employee',
    auth0UserId: 'auth0|employee',
  };

  const scraperUser: AuthUser = {
    ...businessOwnerUser,
    userId: 'user-4',
    email: 'scraper@example.com',
    roleId: 'scraper',
    auth0UserId: 'auth0|scraper',
  };

  beforeEach(() => {
    mockAuthProvider = {
      getAuthContext: vi.fn(),
    };
    service = new AuthorizationProvider(mockAuthProvider as AuthContextProvider);
  });

  it('requireAuth returns user when authenticated', async () => {
    vi.mocked(mockAuthProvider.getAuthContext).mockResolvedValue({
      authType: 'jwt',
      user: businessOwnerUser,
      tenant: { businessId: 'biz-1', roleId: 'business_owner' },
    });

    const result = await service.requireAuth();

    expect(result).toEqual(businessOwnerUser);
  });

  it('requireAuth throws UNAUTHENTICATED when no user', async () => {
    vi.mocked(mockAuthProvider.getAuthContext).mockResolvedValue(null);

    await expect(service.requireAuth()).rejects.toMatchObject({
      extensions: { code: 'UNAUTHENTICATED' },
      message: 'Authentication required',
    });
  });

  it('requireRole returns user when role matches', async () => {
    vi.mocked(mockAuthProvider.getAuthContext).mockResolvedValue({
      authType: 'jwt',
      user: accountantUser,
      tenant: { businessId: 'biz-1', roleId: 'accountant' },
    });

    const result = await service.requireRole(['business_owner', 'accountant']);

    expect(result).toEqual(accountantUser);
  });

  it("requireRole throws FORBIDDEN when role doesn't match", async () => {
    vi.mocked(mockAuthProvider.getAuthContext).mockResolvedValue({
      authType: 'jwt',
      user: employeeUser,
      tenant: { businessId: 'biz-1', roleId: 'employee' },
    });

    await expect(service.requireRole(['business_owner', 'accountant'])).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
      message: 'Access denied. Required roles: business_owner, accountant',
    });
  });

  it('requireBusinessOwner restricts to business_owner', async () => {
    vi.mocked(mockAuthProvider.getAuthContext).mockResolvedValue({
      authType: 'jwt',
      user: accountantUser,
      tenant: { businessId: 'biz-1', roleId: 'accountant' },
    });

    await expect(service.requireBusinessOwner()).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });

    vi.mocked(mockAuthProvider.getAuthContext).mockResolvedValue({
      authType: 'jwt',
      user: businessOwnerUser,
      tenant: { businessId: 'biz-1', roleId: 'business_owner' },
    });

    const result = await service.requireBusinessOwner();

    expect(result).toEqual(businessOwnerUser);
  });

  it('canWrite allows business_owner and accountant; blocks employee and scraper', async () => {
    vi.mocked(mockAuthProvider.getAuthContext).mockResolvedValue({
      authType: 'jwt',
      user: businessOwnerUser,
      tenant: { businessId: 'biz-1', roleId: 'business_owner' },
    });
    await expect(service.canWrite()).resolves.toEqual(businessOwnerUser);

    vi.mocked(mockAuthProvider.getAuthContext).mockResolvedValue({
      authType: 'jwt',
      user: accountantUser,
      tenant: { businessId: 'biz-1', roleId: 'accountant' },
    });
    await expect(service.canWrite()).resolves.toEqual(accountantUser);

    vi.mocked(mockAuthProvider.getAuthContext).mockResolvedValue({
      authType: 'jwt',
      user: employeeUser,
      tenant: { businessId: 'biz-1', roleId: 'employee' },
    });
    await expect(service.canWrite()).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });

    vi.mocked(mockAuthProvider.getAuthContext).mockResolvedValue({
      authType: 'jwt',
      user: scraperUser,
      tenant: { businessId: 'biz-1', roleId: 'scraper' },
    });
    await expect(service.canWrite()).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
  });
});
