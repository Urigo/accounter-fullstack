import { describe, expect, it, vi } from 'vitest';
import { userContextResolvers } from '../resolvers/user-context.resolver.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';

// Baseline guardrails for the multi-business migration.
// These lock the CURRENT single-business `userContext` contract so the hard-cut
// in a later step (memberships + active read scope replacing `adminBusinessId`)
// is visible as an intentional change rather than a silent regression.

type AdminContextFixture = Awaited<ReturnType<AdminContextProvider['getVerifiedAdminContext']>>;

function buildInjector(adminContext: AdminContextFixture) {
  return {
    get: vi.fn().mockReturnValue({
      getVerifiedAdminContext: vi.fn().mockResolvedValue(adminContext),
    }),
  };
}

async function runResolver(adminContext: AdminContextFixture) {
  const injector = buildInjector(adminContext);
  // The resolver only reads `injector` from the context.
  const resolver = userContextResolvers.Query!.userContext as (
    parent: unknown,
    args: unknown,
    context: { injector: ReturnType<typeof buildInjector> },
    info: unknown,
  ) => Promise<Record<string, unknown>>;
  return resolver(undefined, undefined, { injector }, undefined);
}

const baseContext = {
  ownerId: 'owner-1',
  defaultLocalCurrency: 'ILS',
  defaultCryptoConversionFiatCurrency: 'USD',
  ledgerLock: '2024-01-01',
  locality: 'ISRAEL',
  financialAccounts: { internalWalletsIds: ['wallet-1', 'wallet-2'] },
  bankDeposits: { bankDepositBusinessId: null },
} as AdminContextFixture;

describe('userContext resolver (single-business baseline)', () => {
  it('exposes the single admin business as adminBusinessId', async () => {
    const result = await runResolver(baseContext);

    // Single-business contract: exactly one business id, scalar (not an array).
    expect(result.adminBusinessId).toBe('owner-1');
    expect(Array.isArray(result.adminBusinessId)).toBe(false);
  });

  it('passes through currency, ledger lock, and locality unchanged', async () => {
    const result = await runResolver(baseContext);

    expect(result.defaultLocalCurrency).toBe('ILS');
    expect(result.defaultCryptoConversionFiatCurrency).toBe('USD');
    expect(result.ledgerLock).toBe('2024-01-01');
    expect(result.locality).toBe('ISRAEL');
  });

  it('returns internal wallet ids when there is no bank deposit business', async () => {
    const result = await runResolver(baseContext);

    expect(result.financialAccountsBusinessesIds).toEqual(['wallet-1', 'wallet-2']);
  });

  it('appends the bank deposit business id to financial accounts when present', async () => {
    const result = await runResolver({
      ...baseContext,
      bankDeposits: { bankDepositBusinessId: 'bank-deposit-1', bankDepositInterestIncomeTaxCategoryId: null },
    });

    expect(result.financialAccountsBusinessesIds).toEqual([
      'wallet-1',
      'wallet-2',
      'bank-deposit-1',
    ]);
  });
});
