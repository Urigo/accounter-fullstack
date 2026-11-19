import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChargeTypeEnum } from '../../../../shared/enums.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { BusinessTripsProvider } from '../../../business-trips/providers/business-trips.provider.js';
import { CreditCardStatementsProvider } from '../../../transactions/providers/creditcard-statements.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import type { IGetChargesByIdsResult } from '../../types.js';
import { forgetDerivedChargeType, getChargeType } from '../charge-type.js';
import { getChargeBusinesses } from '../common.helper.js';

vi.mock('../common.helper.js', () => ({ getChargeBusinesses: vi.fn() }));
vi.mock('../../../foreign-securities/helpers/foreign-securities-businesses.helper.js', () => ({
  getForeignSecuritiesBusinessIds: vi.fn(async () => new Set<string>()),
}));

// Synthetic values only
const ISSUER = 'business-card-issuer';
const SUPPLIER = 'business-supplier';

const charge = {
  id: 'charge-1',
  owner_id: 'owner-business',
  type: null,
} as IGetChargesByIdsResult;

function makeInjector(linkedChargeIds: string[]) {
  const hasLinks = vi.fn(
    async ({ chargeId, ownerId }: { chargeId: string; ownerId: string }) =>
      ownerId === charge.owner_id && linkedChargeIds.includes(chargeId),
  );
  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      {
        getVerifiedAdminContext: async () => ({
          bankDeposits: { bankDepositBusinessId: null },
          dividends: { dividendBusinessIds: [] },
          authorities: { vatBusinessId: 'business-vat' },
          financialAccounts: { creditCardIds: [ISSUER] },
        }),
      },
    ],
    [BusinessTripsProvider, { getBusinessTripsByChargeIdLoader: { load: async () => null } }],
    [
      TransactionsProvider,
      {
        transactionsByChargeIDLoader: {
          load: async () => [{ id: 'bank-debit', account_id: 'account-bank' }],
        },
      },
    ],
    [CreditCardStatementsProvider, { hasLinksByChargeIdLoader: { load: hasLinks } }],
  ]);
  const injector = {
    get: (token: unknown) => {
      if (!providers.has(token)) {
        throw new Error(`Unexpected provider token: ${String(token)}`);
      }
      return providers.get(token);
    },
  } as unknown as Injector;
  return { injector, hasLinks };
}

function withMainBusiness(mainBusinessId: string | null) {
  vi.mocked(getChargeBusinesses).mockResolvedValue({
    allBusinessIds: mainBusinessId ? [mainBusinessId] : [],
    mainBusinessIds: mainBusinessId ? [mainBusinessId] : [],
    offsettingBusinessIds: [],
    spansSeveralSecurities: false,
    mainBusinessId,
  });
}

describe('getChargeType — card debits', () => {
  beforeEach(() => {
    vi.mocked(getChargeBusinesses).mockReset();
  });

  it('derives a card debit from a card issuer counterparty', async () => {
    withMainBusiness(ISSUER);
    const { injector } = makeInjector([]);

    await expect(getChargeType(charge, injector)).resolves.toBe(
      ChargeTypeEnum.CreditcardBankCharge,
    );
  });

  it('derives a card debit from a stored link, with a non-issuer counterparty', async () => {
    withMainBusiness(SUPPLIER);
    const { injector } = makeInjector([charge.id]);

    await expect(getChargeType(charge, injector)).resolves.toBe(
      ChargeTypeEnum.CreditcardBankCharge,
    );
  });

  it('derives a card debit from a stored link, with no counterparty', async () => {
    withMainBusiness(null);
    const { injector } = makeInjector([charge.id]);

    await expect(getChargeType(charge, injector)).resolves.toBe(
      ChargeTypeEnum.CreditcardBankCharge,
    );
  });

  it('leaves an unlinked charge common', async () => {
    withMainBusiness(SUPPLIER);
    const { injector } = makeInjector([]);

    await expect(getChargeType(charge, injector)).resolves.toBe(ChargeTypeEnum.Common);
  });

  it('keeps earlier rules first: a linked monthly VAT charge stays a VAT charge', async () => {
    withMainBusiness('business-vat');
    const { injector, hasLinks } = makeInjector([charge.id]);

    await expect(getChargeType(charge, injector)).resolves.toBe(ChargeTypeEnum.MonthlyVat);
    expect(hasLinks).not.toHaveBeenCalled();
  });

  it('keeps a stored charge type', async () => {
    const { injector, hasLinks } = makeInjector([charge.id]);

    await expect(getChargeType({ ...charge, type: 'COMMON' }, injector)).resolves.toBe(
      ChargeTypeEnum.Common,
    );
    expect(hasLinks).not.toHaveBeenCalled();
  });

  it('derives the type again once forgotten', async () => {
    withMainBusiness(SUPPLIER);
    const linked: string[] = [];
    const { injector } = makeInjector(linked);

    await expect(getChargeType(charge, injector)).resolves.toBe(ChargeTypeEnum.Common);
    linked.push(charge.id);
    // memoized for the request
    await expect(getChargeType(charge, injector)).resolves.toBe(ChargeTypeEnum.Common);

    forgetDerivedChargeType(injector, charge.id);
    await expect(getChargeType(charge, injector)).resolves.toBe(
      ChargeTypeEnum.CreditcardBankCharge,
    );
  });
});
