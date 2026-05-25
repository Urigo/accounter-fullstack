import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../../../../shared/types/auth.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { AuthContextProvider } from '../auth-context.provider.js';
import { ScopeProvider } from '../scope.provider.js';

function buildProvider(authContext: AuthContext | null, adminByOwnerId: Record<string, unknown> = {}) {
  const authContextProvider = {
    getAuthContext: vi.fn().mockResolvedValue(authContext),
  } as unknown as AuthContextProvider;
  const loadFn = vi.fn((ownerId: string) => Promise.resolve(adminByOwnerId[ownerId] ?? null));
  const adminContextProvider = {
    adminContextByOwnerIdLoader: { load: loadFn },
  } as unknown as AdminContextProvider;
  return {
    provider: new ScopeProvider(authContextProvider, adminContextProvider),
    getAdminContextByOwnerId: loadFn,
  };
}

const authContext: AuthContext = {
  authType: 'jwt',
  tenant: { businessId: 'b-1' },
  memberships: [
    { businessId: 'b-1', roleId: 'owner' },
    { businessId: 'b-2', roleId: 'accountant' },
  ],
  activeReadScope: { businessIds: ['b-1', 'b-2'] },
};

describe('ScopeProvider.getReadScope', () => {
  it('defaults to the full authorized scope when no args are given', async () => {
    const { provider } = buildProvider(authContext);
    await expect(provider.getReadScope()).resolves.toEqual(['b-1', 'b-2']);
  });

  it('narrows to the requested args within the authorized scope', async () => {
    const { provider } = buildProvider(authContext);
    await expect(provider.getReadScope(['b-2'])).resolves.toEqual(['b-2']);
  });

  it('rejects args outside the authorized scope', async () => {
    const { provider } = buildProvider(authContext);
    await expect(provider.getReadScope(['b-9'])).rejects.toThrow(/outside the authorized read scope/);
  });

  it('throws when unauthenticated', async () => {
    const { provider } = buildProvider(null);
    await expect(provider.getReadScope()).rejects.toThrow(/Authentication required/);
  });
});

describe('ScopeProvider.resolveWriteTarget', () => {
  let provider: ScopeProvider;
  beforeEach(() => {
    provider = buildProvider(authContext).provider;
  });

  it('returns the target when it is a membership', async () => {
    await expect(provider.resolveWriteTarget('b-2')).resolves.toBe('b-2');
  });

  it('throws when no target is provided', async () => {
    await expect(provider.resolveWriteTarget(undefined)).rejects.toThrow(/explicit target businessId/);
  });

  it('throws when the target is not a membership', async () => {
    await expect(provider.resolveWriteTarget('b-9')).rejects.toThrow(/Not authorized to write/);
  });
});

describe('ScopeProvider.getBusinessPreference', () => {
  it('returns the requested preference for a business within scope', async () => {
    const { provider, getAdminContextByOwnerId } = buildProvider(authContext, {
      'b-2': { defaultLocalCurrency: 'USD' },
    });
    await expect(provider.getBusinessPreference('b-2', 'defaultLocalCurrency')).resolves.toBe('USD');
    expect(getAdminContextByOwnerId).toHaveBeenCalledWith('b-2');
  });

  it('returns null when the business has no admin context', async () => {
    const { provider } = buildProvider(authContext, {});
    await expect(provider.getBusinessPreference('b-2', 'defaultLocalCurrency')).resolves.toBeNull();
  });

  it('rejects a business outside the authorized read scope', async () => {
    const { provider } = buildProvider(authContext);
    await expect(
      provider.getBusinessPreference('b-9', 'defaultLocalCurrency'),
    ).rejects.toThrow(/outside the authorized read scope/);
  });
});
