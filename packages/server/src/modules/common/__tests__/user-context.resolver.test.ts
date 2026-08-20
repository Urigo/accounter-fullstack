import { describe, expect, it, vi } from 'vitest';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';
import { userContextResolvers } from '../resolvers/user-context.resolver.js';

type AdminContextFixture = Awaited<ReturnType<AdminContextProvider['getVerifiedAdminContext']>>;
type AuthContextValue = Awaited<ReturnType<AuthContextProvider['getAuthContext']>>;

function buildInjector(authContext: AuthContextValue, adminContext: AdminContextFixture) {
  const adminProvider = { getVerifiedAdminContext: vi.fn().mockResolvedValue(adminContext) };
  const authProvider = { getAuthContext: vi.fn().mockResolvedValue(authContext) };
  const financialEntitiesProvider = {
    getFinancialEntityByIdLoader: {
      load: vi.fn().mockResolvedValue(null),
    },
  };
  const injector = {
    get: vi.fn((token: unknown) => {
      if (token === AuthContextProvider) {
        return authProvider;
      }
      if (token === FinancialEntitiesProvider) {
        return financialEntitiesProvider;
      }
      return adminProvider;
    }),
  };
  return { injector, adminProvider, authProvider };
}

async function runResolver(authContext: AuthContextValue, adminContext: AdminContextFixture) {
  const { injector, adminProvider } = buildInjector(authContext, adminContext);
  const resolver = userContextResolvers.Query!.userContext as unknown as (
    parent: unknown,
    args: unknown,
    context: { injector: { get: (token: unknown) => unknown } },
    info: unknown,
  ) => Promise<Record<string, unknown>>;
  const result = await resolver(undefined, undefined, { injector }, undefined);
  return { result, adminProvider };
}

const adminContext = {
  defaultLocalCurrency: 'ILS',
  defaultCryptoConversionFiatCurrency: 'USD',
  ledgerLock: '2024-01-01',
  locality: 'ISRAEL',
  financialAccounts: { internalWalletsIds: ['wallet-1', 'wallet-2'] },
  bankDeposits: { bankDepositBusinessId: null },
} as AdminContextFixture;

const authContext = {
  authType: 'jwt',
  tenant: { businessId: 'b-1' },
  memberships: [
    { businessId: 'b-1', roleId: 'business_owner', businessName: 'Acme' },
    { businessId: 'b-2', roleId: 'accountant' },
  ],
  activeReadScope: { businessIds: ['b-1'] },
} as AuthContextValue;

describe('userContext resolver (multi-business)', () => {
  it('returns the full membership list, mapping role and name', async () => {
    const { result } = await runResolver(authContext, adminContext);
    expect(result.memberships).toEqual([
      { businessId: 'b-1', role: 'business_owner', businessName: 'Acme' },
      { businessId: 'b-2', role: 'accountant', businessName: null },
    ]);
  });

  it('exposes the active read scope and no longer exposes adminBusinessId', async () => {
    const { result } = await runResolver(authContext, adminContext);
    expect(result.activeReadScope).toEqual(['b-1']);
    expect(result).not.toHaveProperty('adminBusinessId');
  });

  it('populates single-business preference fields when the scope is one business', async () => {
    const { result, adminProvider } = await runResolver(authContext, adminContext);
    expect(adminProvider.getVerifiedAdminContext).toHaveBeenCalled();
    expect(result.defaultLocalCurrency).toBe('ILS');
    expect(result.defaultCryptoConversionFiatCurrency).toBe('USD');
    expect(result.ledgerLock).toBe('2024-01-01');
    expect(result.locality).toBe('ISRAEL');
    expect(result.financialAccountsBusinessesIds).toEqual(['wallet-1', 'wallet-2']);
  });

  it('appends the bank deposit business id when present', async () => {
    const { result } = await runResolver(authContext, {
      ...adminContext,
      bankDeposits: {
        bankDepositBusinessId: 'bank-deposit-1',
        bankDepositInterestIncomeTaxCategoryId: null,
      },
    } as AdminContextFixture);
    expect(result.financialAccountsBusinessesIds).toEqual([
      'wallet-1',
      'wallet-2',
      'bank-deposit-1',
    ]);
  });

  it('nulls single-business fields and skips admin context for a multi-business scope', async () => {
    const multiScope = {
      ...authContext,
      activeReadScope: { businessIds: ['b-1', 'b-2'] },
    } as AuthContextValue;

    const { result, adminProvider } = await runResolver(multiScope, adminContext);

    expect(result.activeReadScope).toEqual(['b-1', 'b-2']);
    expect(result.defaultLocalCurrency).toBeNull();
    expect(result.defaultCryptoConversionFiatCurrency).toBeNull();
    expect(result.ledgerLock).toBeNull();
    expect(result.financialAccountsBusinessesIds).toBeNull();
    expect(result.locality).toBeNull();
    expect(adminProvider.getVerifiedAdminContext).not.toHaveBeenCalled();
  });
});
